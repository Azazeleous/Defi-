/**
 * =============================================================================
 * SPECIFICATION: HCCGN.CRYPTIC.INSTANT.MINER v1.0.0 — Section 2 (Tier 3) & Network
 * MODULE: Real TCP Stratum v1 Server & Client + WebRTC ICE Policy & RTP Clock Sync
 * NOTE: Uses real Node.js `net` TCP sockets for JSON-RPC Stratum v1 frames.
 *       Zero fake network responses or fabricated pool acceptances.
 * =============================================================================
 */

import net from 'node:net';
import crypto from 'node:crypto';
import {
  MiningNetworkProfile,
  RtpClockSyncFrame,
  StratumJobRecord,
  StratumShareSubmissionRecord,
  StratumTransportStatus,
  WebRtcIceConfig,
  WebRtcPeerRecord,
} from '../contracts/cryptic-platform';
import {
  blake2b256Hex,
  doubleSha256Hex,
  meetsLeadingZeroHexTarget,
  scryptSalsaPowHex,
  sha256Hex,
} from './algorithmRegistry';
import { SqliteLedgerStore, globalSqliteLedger } from './sqliteLedgerStore';

export const SUPPORTED_MINING_NETWORKS: readonly MiningNetworkProfile[] = [
  {
    networkId: 'local.stratum.sha256',
    name: 'Local CRYPTIC Stratum v1 Pool (Double-SHA256)',
    consensusType: 'POW',
    powAlgorithmId: 'crypto.sha256',
    targetFormat: 'Leading zero hex nibbles (stratum difficulty)',
    minableByCoordinator: true,
    note: 'Real local TCP JSON-RPC Stratum v1 server bound to localhost socket.',
  },
  {
    networkId: 'local.pow.blake2b',
    name: 'Local CRYPTIC Benchmark Net (BLAKE2b-256)',
    consensusType: 'BENCHMARK_LOCAL',
    powAlgorithmId: 'crypto.blake2b256',
    targetFormat: 'Leading zero hex nibbles (BLAKE2b-256)',
    minableByCoordinator: true,
    note: 'Deterministic RFC 7693 BLAKE2b candidate validation loop.',
  },
  {
    networkId: 'local.pow.scrypt',
    name: 'Local CRYPTIC Scrypt-Salsa20/8 Net',
    consensusType: 'POW',
    powAlgorithmId: 'crypto.scrypt_salsa',
    targetFormat: 'Leading zero hex nibbles (Scrypt N=64 profile)',
    minableByCoordinator: true,
    note: 'Memory-hard Salsa20/8 ROMix PoW test profile.',
  },
  {
    networkId: 'ethereum.pos',
    name: 'Ethereum Mainnet (Proof-of-Stake — Non-Minable)',
    consensusType: 'POS_NON_MINABLE',
    powAlgorithmId: null,
    targetFormat: 'Beacon slot attestation (PoS)',
    minableByCoordinator: false,
    note: 'Proof-of-Stake network: excluded from PoW mining per Section 2 Tier 3.',
  },
  {
    networkId: 'solana.pos',
    name: 'Solana Cluster (Proof-of-History / PoS — Non-Minable)',
    consensusType: 'POS_NON_MINABLE',
    powAlgorithmId: null,
    targetFormat: 'PoH Tower BFT validator vote (PoS)',
    minableByCoordinator: false,
    note: 'Proof-of-Stake network: excluded from PoW mining per Section 2 Tier 3.',
  },
];

export function evaluatePowCandidateDigest(
  algorithmId: string,
  canonicalHeader: string
): string {
  switch (algorithmId) {
    case 'crypto.blake2b256':
      return blake2b256Hex(canonicalHeader);
    case 'crypto.scrypt_salsa':
      return scryptSalsaPowHex(canonicalHeader, 64);
    case 'crypto.sha256':
    default:
      return doubleSha256Hex(canonicalHeader);
  }
}

interface PendingRpc {
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  sentAtNs: bigint;
}

export class StratumNetworkEngine {
  private readonly store: SqliteLedgerStore;
  private server: net.Server | null = null;
  private serverPort: number = Number(process.env.STRATUM_TCP_PORT || 3333);
  private serverHost: string = '127.0.0.1';
  private serverListening: boolean = false;
  private readonly serverSockets = new Set<net.Socket>();
  private activeServerJob: StratumJobRecord | null = null;
  private serverAcceptedShares: number = 0;
  private serverRejectedShares: number = 0;

  // Real TCP client socket
  private clientSocket: net.Socket | null = null;
  private clientBuffer: string = '';
  private clientRpcSeq: number = 1;
  private readonly pendingRpcs = new Map<number, PendingRpc>();
  private clientConnected: boolean = false;
  private clientTargetHost: string | null = null;
  private clientTargetPort: number | null = null;
  private clientSubscribed: boolean = false;
  private clientAuthorizedWorker: string | null = null;
  private clientExtranonce1: string | null = null;
  private clientDifficulty: number = 2;
  private clientActiveJob: StratumJobRecord | null = null;
  private lastClientRttMs: number | null = null;
  private lastClientError: string | null = null;

  // WebRTC Signaling Peers & RTP Clock Sync
  private readonly webrtcPeers = new Map<string, WebRtcPeerRecord>();
  private rtpSeq: number = 1;
  private rtpLastSendNs: bigint = process.hrtime.bigint();
  private rtpJitterUs: number = 0;
  private readonly rtpSsrc: string = crypto.randomBytes(4).toString('hex').toUpperCase();

  private readonly onShareCallbacks = new Set<(share: StratumShareSubmissionRecord) => void>();

  constructor(store: SqliteLedgerStore = globalSqliteLedger) {
    this.store = store;
  }

  public onShareRecorded(cb: (share: StratumShareSubmissionRecord) => void): () => void {
    this.onShareCallbacks.add(cb);
    return () => this.onShareCallbacks.delete(cb);
  }

  public startLocalStratumServer(requestedPort?: number): Promise<{ host: string; port: number; activeJob: StratumJobRecord }> {
    if (this.server && this.serverListening) {
      const job = this.activeServerJob || this.issueNewStratumJob('crypto.sha256', this.clientDifficulty);
      return Promise.resolve({ host: this.serverHost, port: this.serverPort, activeJob: job });
    }

    const desiredPort = typeof requestedPort === 'number' ? requestedPort : this.serverPort;
    return new Promise((resolve, reject) => {
      const srv = net.createServer((socket) => {
        this.serverSockets.add(socket);
        const socketExtranonce1 = crypto.randomBytes(4).toString('hex');
        let lineBuf = '';

        socket.on('data', (chunk) => {
          lineBuf += chunk.toString('utf8');
          let nlIdx = lineBuf.indexOf('\n');
          while (nlIdx !== -1) {
            const rawLine = lineBuf.slice(0, nlIdx).trim();
            lineBuf = lineBuf.slice(nlIdx + 1);
            if (rawLine) {
              this.handleStratumServerRpc(socket, socketExtranonce1, rawLine);
            }
            nlIdx = lineBuf.indexOf('\n');
          }
        });

        socket.on('close', () => {
          this.serverSockets.delete(socket);
        });
        socket.on('error', () => {
          this.serverSockets.delete(socket);
        });
      });

      srv.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE' && desiredPort !== 0) {
          // Bind cleanly on an OS ephemeral port so local Stratum TCP remains genuinely reachable
          srv.listen(0, this.serverHost, () => {
            const addr = srv.address() as net.AddressInfo;
            this.server = srv;
            this.serverPort = addr.port;
            this.serverListening = true;
            const job = this.issueNewStratumJob('crypto.sha256', this.clientDifficulty);
            resolve({ host: this.serverHost, port: this.serverPort, activeJob: job });
          });
        } else {
          reject(err);
        }
      });

      srv.listen(desiredPort, this.serverHost, () => {
        const addr = srv.address() as net.AddressInfo;
        this.server = srv;
        this.serverPort = addr.port;
        this.serverListening = true;
        const job = this.issueNewStratumJob('crypto.sha256', this.clientDifficulty);
        resolve({ host: this.serverHost, port: this.serverPort, activeJob: job });
      });
    });
  }

  public stopLocalStratumServer(): void {
    this.disconnectStratumClient();
    for (const s of this.serverSockets) {
      s.destroy();
    }
    this.serverSockets.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.serverListening = false;
  }

  public issueNewStratumJob(algorithmId: string = 'crypto.sha256', difficultyZeroNibbles: number = 2): StratumJobRecord {
    const nowUtc = new Date().toISOString();
    const job: StratumJobRecord = {
      stratumJobId: `job_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
      networkId:
        algorithmId === 'crypto.blake2b256'
          ? 'local.pow.blake2b'
          : algorithmId === 'crypto.scrypt_salsa'
            ? 'local.pow.scrypt'
            : 'local.stratum.sha256',
      algorithmId,
      prevHashHex: sha256Hex(`PREV_${nowUtc}_${crypto.randomBytes(4).toString('hex')}`),
      headerTemplateHex: crypto.randomBytes(16).toString('hex'),
      extranonce1Hex: '00000001',
      difficultyZeroNibbles: Math.max(1, Math.min(6, difficultyZeroNibbles)),
      cleanJobs: true,
      createdAtUtc: nowUtc,
    };
    this.activeServerJob = job;
    this.store.saveStratumJob(job);

    // Push mining.notify over all connected TCP sockets
    const notifyFrame = JSON.stringify({
      id: null,
      method: 'mining.notify',
      params: [
        job.stratumJobId,
        job.prevHashHex,
        job.headerTemplateHex,
        job.algorithmId,
        [],
        '20000000',
        `0000000${job.difficultyZeroNibbles}`,
        Math.floor(Date.now() / 1000).toString(16),
        job.cleanJobs,
      ],
    }) + '\n';
    for (const sock of this.serverSockets) {
      if (!sock.destroyed) {
        sock.write(notifyFrame);
      }
    }
    return job;
  }

  private handleStratumServerRpc(socket: net.Socket, extranonce1: string, rawLine: string): void {
    let msg: any;
    try {
      msg = JSON.parse(rawLine);
    } catch {
      socket.write(JSON.stringify({ id: null, result: null, error: [20, 'Malformed JSON-RPC', null] }) + '\n');
      return;
    }

    const id = msg.id ?? null;
    const method = msg.method;
    const params: any[] = Array.isArray(msg.params) ? msg.params : [];

    if (method === 'mining.subscribe') {
      const response = {
        id,
        result: [[['mining.set_difficulty', 'sub_1'], ['mining.notify', 'sub_2']], extranonce1, 4],
        error: null,
      };
      socket.write(JSON.stringify(response) + '\n');
      if (this.activeServerJob) {
        socket.write(
          JSON.stringify({
            id: null,
            method: 'mining.set_difficulty',
            params: [this.activeServerJob.difficultyZeroNibbles],
          }) + '\n'
        );
        socket.write(
          JSON.stringify({
            id: null,
            method: 'mining.notify',
            params: [
              this.activeServerJob.stratumJobId,
              this.activeServerJob.prevHashHex,
              this.activeServerJob.headerTemplateHex,
              this.activeServerJob.algorithmId,
              [],
              '20000000',
              `0000000${this.activeServerJob.difficultyZeroNibbles}`,
              Math.floor(Date.now() / 1000).toString(16),
              this.activeServerJob.cleanJobs,
            ],
          }) + '\n'
        );
      }
      return;
    }

    if (method === 'mining.authorize') {
      socket.write(JSON.stringify({ id, result: true, error: null }) + '\n');
      return;
    }

    if (method === 'mining.submit') {
      // params: [workerName, jobId, extranonce2, ntime, nonce]
      const [workerName, jobId, extranonce2, ntime, nonceHex] = params.map((p) => String(p ?? ''));
      const job = this.store.getStratumJob(jobId) || this.activeServerJob;
      if (!job || job.stratumJobId !== jobId) {
        this.serverRejectedShares++;
        socket.write(JSON.stringify({ id, result: false, error: [21, 'Job not found / stale job', null] }) + '\n');
        return;
      }

      const canonicalHeader = `${job.stratumJobId}:${job.prevHashHex}:${job.headerTemplateHex}:${extranonce1}:${extranonce2}:${ntime}:${nonceHex}`;
      const digestHex = evaluatePowCandidateDigest(job.algorithmId, canonicalHeader);
      const meetsTarget = meetsLeadingZeroHexTarget(digestHex, job.difficultyZeroNibbles);

      const receiptId = `rcp_share_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
      const rttNs = '0';
      if (!meetsTarget) {
        this.serverRejectedShares++;
        const rejectedRecord: StratumShareSubmissionRecord = {
          shareId: `shr_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
          workerId: workerName || 'unknown',
          jobId,
          extranonce2Hex: extranonce2,
          ntimeHex: ntime,
          nonceHex,
          candidateDigestHex: digestHex,
          meetsTarget: false,
          isDuplicate: false,
          poolAccepted: false,
          poolRejectReason: `Digest ${digestHex.slice(0, 12)}... above difficulty target (${job.difficultyZeroNibbles} zero nibbles)`,
          poolRttNs: rttNs,
          receiptId,
          submittedAtUtc: new Date().toISOString(),
        };
        this.store.recordStratumShare(rejectedRecord);
        socket.write(
          JSON.stringify({
            id,
            result: false,
            error: [23, rejectedRecord.poolRejectReason, { digestHex }],
          }) + '\n'
        );
        return;
      }

      const acceptedRecord: StratumShareSubmissionRecord = {
        shareId: `shr_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
        workerId: workerName || 'unknown',
        jobId,
        extranonce2Hex: extranonce2,
        ntimeHex: ntime,
        nonceHex,
        candidateDigestHex: digestHex,
        meetsTarget: true,
        isDuplicate: false,
        poolAccepted: true,
        poolRejectReason: null,
        poolRttNs: rttNs,
        receiptId,
        submittedAtUtc: new Date().toISOString(),
      };
      const dbRes = this.store.recordStratumShare(acceptedRecord);
      if (dbRes.duplicate) {
        this.serverRejectedShares++;
        socket.write(
          JSON.stringify({
            id,
            result: false,
            error: [22, 'Duplicate share rejected (jobId + extranonce2 + ntime + nonce already settled)', null],
          }) + '\n'
        );
        return;
      }

      this.serverAcceptedShares++;
      this.onShareCallbacks.forEach((cb) => cb(acceptedRecord));
      socket.write(
        JSON.stringify({
          id,
          result: true,
          error: null,
          ack: { shareId: acceptedRecord.shareId, digestHex },
        }) + '\n'
      );
      return;
    }

    socket.write(JSON.stringify({ id, result: null, error: [-32601, `Unknown Stratum method: ${method}`, null] }) + '\n');
  }

  // ===========================================================================
  // STRATUM TCP CLIENT (REAL SOCKET CONNECTION)
  // ===========================================================================
  public async connectStratumClient(
    host: string,
    port: number,
    workerName: string = 'cryptic.worker.01'
  ): Promise<StratumTransportStatus> {
    this.disconnectStratumClient();
    this.lastClientError = null;

    await new Promise<void>((resolve, reject) => {
      const sock = new net.Socket();
      const timeout = setTimeout(() => {
        sock.destroy();
        reject(new Error(`TCP connection timeout to ${host}:${port}`));
      }, 3500);

      sock.connect(port, host, () => {
        clearTimeout(timeout);
        this.clientSocket = sock;
        this.clientConnected = true;
        this.clientTargetHost = host;
        this.clientTargetPort = port;
        resolve();
      });

      sock.on('data', (chunk) => {
        this.clientBuffer += chunk.toString('utf8');
        let idx = this.clientBuffer.indexOf('\n');
        while (idx !== -1) {
          const line = this.clientBuffer.slice(0, idx).trim();
          this.clientBuffer = this.clientBuffer.slice(idx + 1);
          if (line) {
            this.handleClientIncomingLine(line);
          }
          idx = this.clientBuffer.indexOf('\n');
        }
      });

      sock.on('error', (err) => {
        clearTimeout(timeout);
        this.lastClientError = err.message;
        this.clientConnected = false;
        reject(err);
      });

      sock.on('close', () => {
        this.clientConnected = false;
        this.clientSubscribed = false;
        this.clientAuthorizedWorker = null;
      });
    });

    // Perform authentic Stratum JSON-RPC handshake: subscribe -> authorize
    const subResp = await this.sendClientRpc('mining.subscribe', ['HCCGN.CRYPTIC/1.0.0']);
    if (Array.isArray(subResp.result)) {
      this.clientSubscribed = true;
      this.clientExtranonce1 = String(subResp.result[1] || '00000001');
    }

    const authResp = await this.sendClientRpc('mining.authorize', [workerName, 'x']);
    if (authResp.result === true) {
      this.clientAuthorizedWorker = workerName;
    }

    return this.getStatus();
  }

  public disconnectStratumClient(): void {
    if (this.clientSocket) {
      this.clientSocket.destroy();
      this.clientSocket = null;
    }
    this.clientConnected = false;
    this.clientSubscribed = false;
    this.clientAuthorizedWorker = null;
    this.clientTargetHost = null;
    this.clientTargetPort = null;
    this.pendingRpcs.forEach((p) => p.reject(new Error('Stratum client disconnected')));
    this.pendingRpcs.clear();
  }

  private handleClientIncomingLine(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (typeof msg.id === 'number' && this.pendingRpcs.has(msg.id)) {
        const pending = this.pendingRpcs.get(msg.id)!;
        this.pendingRpcs.delete(msg.id);
        const rttNs = process.hrtime.bigint() - pending.sentAtNs;
        this.lastClientRttMs = +(Number(rttNs) / 1_000_000).toFixed(3);
        pending.resolve({ ...msg, measuredRttNs: rttNs.toString() });
        return;
      }

      if (msg.method === 'mining.set_difficulty' && Array.isArray(msg.params)) {
        this.clientDifficulty = Number(msg.params[0]) || 2;
      } else if (msg.method === 'mining.notify' && Array.isArray(msg.params)) {
        const [jobId, prevHashHex, headerTemplateHex, algId] = msg.params;
        this.clientActiveJob = {
          stratumJobId: String(jobId),
          networkId: 'local.stratum.sha256',
          algorithmId: String(algId || 'crypto.sha256'),
          prevHashHex: String(prevHashHex),
          headerTemplateHex: String(headerTemplateHex),
          extranonce1Hex: this.clientExtranonce1 || '00000001',
          difficultyZeroNibbles: this.clientDifficulty,
          cleanJobs: true,
          createdAtUtc: new Date().toISOString(),
        };
      }
    } catch {
      // Ignore malformed downstream frame
    }
  }

  private sendClientRpc(method: string, params: unknown[]): Promise<any> {
    if (!this.clientSocket || this.clientSocket.destroyed || !this.clientConnected) {
      return Promise.reject(new Error('Stratum TCP client is not connected'));
    }
    const id = this.clientRpcSeq++;
    const payload = JSON.stringify({ id, method, params }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRpcs.delete(id);
        reject(new Error(`Stratum RPC timeout for ${method}`));
      }, 3000);

      this.pendingRpcs.set(id, {
        sentAtNs: process.hrtime.bigint(),
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.clientSocket!.write(payload);
    });
  }

  /**
   * Finds a genuine valid PoW nonce locally (up to maxAttempts), then submits
   * over the active TCP Stratum socket and returns the authentic pool response.
   */
  public async mineAndSubmitShareViaTcp(
    workerName: string,
    overrideNonceHex?: string,
    maxSearchIterations: number = 150000
  ): Promise<{
    accepted: boolean;
    duplicate: boolean;
    error: string | null;
    share: StratumShareSubmissionRecord;
  }> {
    if (!this.clientConnected || !this.clientSubscribed || !this.clientAuthorizedWorker) {
      throw new Error('Must connect, subscribe, and authorize Stratum TCP client before submitting shares.');
    }
    const job = this.clientActiveJob || this.activeServerJob;
    if (!job) {
      throw new Error('No active Stratum job received from pool server.');
    }

    const extranonce1 = this.clientExtranonce1 || job.extranonce1Hex;
    const extranonce2 = '00000001';
    const ntime = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');

    let winningNonceHex = overrideNonceHex || '';
    let winningDigest = '';

    if (!overrideNonceHex) {
      for (let i = 0; i < maxSearchIterations; i++) {
        const candidateNonce = i.toString(16).padStart(8, '0');
        const hdr = `${job.stratumJobId}:${job.prevHashHex}:${job.headerTemplateHex}:${extranonce1}:${extranonce2}:${ntime}:${candidateNonce}`;
        const digest = evaluatePowCandidateDigest(job.algorithmId, hdr);
        if (meetsLeadingZeroHexTarget(digest, job.difficultyZeroNibbles)) {
          winningNonceHex = candidateNonce;
          winningDigest = digest;
          break;
        }
      }
      if (!winningNonceHex) {
        throw new Error(`No candidate met difficulty=${job.difficultyZeroNibbles} within ${maxSearchIterations} hashes.`);
      }
    } else {
      const hdr = `${job.stratumJobId}:${job.prevHashHex}:${job.headerTemplateHex}:${extranonce1}:${extranonce2}:${ntime}:${winningNonceHex}`;
      winningDigest = evaluatePowCandidateDigest(job.algorithmId, hdr);
    }

    const rpcResp = await this.sendClientRpc('mining.submit', [
      workerName,
      job.stratumJobId,
      extranonce2,
      ntime,
      winningNonceHex,
    ]);

    const accepted = rpcResp.result === true;
    const errCode = Array.isArray(rpcResp.error) ? rpcResp.error[0] : null;
    const errText = Array.isArray(rpcResp.error) ? String(rpcResp.error[1]) : null;
    const isDuplicate = errCode === 22;

    const share: StratumShareSubmissionRecord = {
      shareId: rpcResp.ack?.shareId || `shr_cli_${Date.now().toString(36)}`,
      workerId: workerName,
      jobId: job.stratumJobId,
      extranonce2Hex: extranonce2,
      ntimeHex: ntime,
      nonceHex: winningNonceHex,
      candidateDigestHex: winningDigest,
      meetsTarget: meetsLeadingZeroHexTarget(winningDigest, job.difficultyZeroNibbles),
      isDuplicate,
      poolAccepted: accepted,
      poolRejectReason: errText,
      poolRttNs: String(rpcResp.measuredRttNs || '0'),
      receiptId: `rcp_cli_${Date.now().toString(36)}`,
      submittedAtUtc: new Date().toISOString(),
    };

    return { accepted, duplicate: isDuplicate, error: errText, share };
  }

  // ===========================================================================
  // WEBRTC STUN/TURN ICE POLICY + RTP CLOCK SYNC FRAMES
  // ===========================================================================
  public getWebRtcIceConfig(): WebRtcIceConfig {
    const stored = this.store.getSetting<WebRtcIceConfig | null>('webrtc_ice_config', null);
    if (stored) {
      return stored;
    }
    const stunRaw = process.env.WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
    const stunUrls = stunRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const turnUrl = process.env.WEBRTC_TURN_URL?.trim() || null;
    const turnUsername = process.env.WEBRTC_TURN_USERNAME?.trim() || null;
    return {
      stunUrls,
      turnConfigured: Boolean(turnUrl && turnUsername),
      turnUrl,
      turnUsername,
      iceTransportPolicy: 'all',
    };
  }

  public updateWebRtcIceConfig(partial: Partial<WebRtcIceConfig>): WebRtcIceConfig {
    const current = this.getWebRtcIceConfig();
    const next: WebRtcIceConfig = {
      stunUrls: Array.isArray(partial.stunUrls) && partial.stunUrls.length > 0 ? partial.stunUrls : current.stunUrls,
      turnUrl: partial.turnUrl !== undefined ? partial.turnUrl : current.turnUrl,
      turnUsername: partial.turnUsername !== undefined ? partial.turnUsername : current.turnUsername,
      turnConfigured: Boolean(
        (partial.turnUrl !== undefined ? partial.turnUrl : current.turnUrl) &&
          (partial.turnUsername !== undefined ? partial.turnUsername : current.turnUsername)
      ),
      iceTransportPolicy: partial.iceTransportPolicy || current.iceTransportPolicy,
    };
    this.store.saveSetting('webrtc_ice_config', next);
    return next;
  }

  public upsertWebRtcPeer(peer: WebRtcPeerRecord): void {
    this.webrtcPeers.set(peer.peerId, peer);
  }

  public listWebRtcPeers(): WebRtcPeerRecord[] {
    return Array.from(this.webrtcPeers.values());
  }

  public sampleRtpClockFrame(): RtpClockSyncFrame {
    const nowNs = process.hrtime.bigint();
    const deltaNs = nowNs - this.rtpLastSendNs;
    this.rtpLastSendNs = nowNs;
    // Nominal 1s / 1000ms cadence variance jitter estimate in microseconds
    const expectedNs = 1_000_000_000n;
    const diffUs = Math.abs(Number(deltaNs - expectedNs)) / 1000;
    this.rtpJitterUs = +(this.rtpJitterUs * 0.85 + Math.min(50000, diffUs) * 0.15).toFixed(2);
    const rtpTimestamp90k = Math.floor((Number(nowNs / 1000n) * 90) / 1000) >>> 0;
    return {
      ssrc: this.rtpSsrc,
      sequenceNumber: this.rtpSeq++,
      rtpTimestamp90k,
      serverMonotonicNs: nowNs.toString(),
      serverUtcMs: Date.now(),
      interarrivalJitterUs: this.rtpJitterUs,
    };
  }

  public getStatus(): StratumTransportStatus {
    return {
      serverListening: this.serverListening,
      serverHost: this.serverHost,
      serverPort: this.serverPort,
      serverActiveClients: this.serverSockets.size,
      serverActiveJobId: this.activeServerJob?.stratumJobId || null,
      serverAcceptedShares: this.serverAcceptedShares,
      serverRejectedShares: this.serverRejectedShares,
      clientConnected: this.clientConnected,
      clientTargetHost: this.clientTargetHost,
      clientTargetPort: this.clientTargetPort,
      clientSubscribed: this.clientSubscribed,
      clientAuthorizedWorker: this.clientAuthorizedWorker,
      clientExtranonce1: this.clientExtranonce1,
      clientDifficulty: this.clientDifficulty,
      lastClientRttMs: this.lastClientRttMs,
      lastClientError: this.lastClientError,
    };
  }
}

export const globalStratumEngine = new StratumNetworkEngine(globalSqliteLedger);
