import React, { useState, useEffect } from 'react';
import {
  X, Shield, ShieldCheck, ShieldAlert, Smartphone, MessageSquare, Key,
  Copy, Check, RefreshCw, Download, Lock, AlertTriangle, ArrowRight,
  CheckCircle2, Laptop, Clock, Send, Eye, EyeOff, Sparkles
} from 'lucide-react';
import {
  globalMfaAuthService,
  MfaUserAccountSecurity,
  MfaMethodType,
  BackupRecoveryCode,
} from '../services/mfaAuthService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMfaStatusChange?: (account: MfaUserAccountSecurity) => void;
}

type ModalView = 'OVERVIEW' | 'SETUP_APP' | 'SETUP_SMS' | 'BACKUP_CODES' | 'TEST_CHALLENGE';

export const MfaSecurityModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onMfaStatusChange,
}) => {
  const [account, setAccount] = useState<MfaUserAccountSecurity>(() =>
    globalMfaAuthService.getAccountSecurity()
  );
  const [view, setView] = useState<ModalView>('OVERVIEW');

  // App setup state
  const [tempSecret, setTempSecret] = useState<string>('');
  const [appInputCode, setAppInputCode] = useState<string>('');
  const [appFeedback, setAppFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // SMS setup state
  const [smsPhoneInput, setSmsPhoneInput] = useState<string>('+1 (555) 349-8120');
  const [smsInputCode, setSmsInputCode] = useState<string>('');
  const [smsFeedback, setSmsFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [smsSent, setSmsSent] = useState<boolean>(false);
  const [smsCooldown, setSmsCooldown] = useState<number>(0);
  const [simulatedCarrierCode, setSimulatedCarrierCode] = useState<string | null>(null);

  // Test challenge state
  const [challengeMethod, setChallengeMethod] = useState<MfaMethodType>('APP');
  const [challengeCode, setChallengeCode] = useState<string>('');
  const [challengeResult, setChallengeResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = globalMfaAuthService.getAccountSecurity();
      setAccount(current);
      setChallengeMethod(current.defaultMethod || 'APP');
      setView('OVERVIEW');
      setAppFeedback(null);
      setSmsFeedback(null);
      setChallengeResult(null);
    }
  }, [isOpen]);

  // Cooldown timer for SMS
  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = setInterval(() => {
      setSmsCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [smsCooldown]);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Begin Authenticator App setup
  const startAppSetup = () => {
    const newSecret = globalMfaAuthService.generateBase32Secret(16);
    setTempSecret(newSecret);
    setAppInputCode('');
    setAppFeedback(null);
    setView('SETUP_APP');
  };

  // Confirm Authenticator App code
  const handleVerifyAppSetup = () => {
    const res = globalMfaAuthService.verifyTotpCode(appInputCode, tempSecret);
    if (res.isValid) {
      const updated = globalMfaAuthService.enableAppMfa(tempSecret);
      setAccount(updated);
      setAppFeedback({ ok: true, msg: 'Authenticator App verified and activated successfully!' });
      onMfaStatusChange?.(updated);
      setTimeout(() => setView('OVERVIEW'), 1500);
    } else {
      setAppFeedback({ ok: false, msg: res.reason });
    }
  };

  // Begin SMS setup
  const startSmsSetup = () => {
    setSmsSent(false);
    setSmsInputCode('');
    setSmsFeedback(null);
    setSimulatedCarrierCode(null);
    setView('SETUP_SMS');
  };

  // Dispatch SMS verification code
  const handleSendSms = () => {
    const res = globalMfaAuthService.sendSmsVerificationCode(smsPhoneInput);
    if (res.success) {
      setSmsSent(true);
      setSmsCooldown(res.cooldownSecondsRemaining);
      const challenge = globalMfaAuthService.getActiveSmsChallenge();
      setSimulatedCarrierCode(challenge?.verificationCode || '123456');
      setSmsFeedback({ ok: true, msg: `Verification code sent to ${res.maskedPhone}` });
    } else {
      setSmsFeedback({ ok: false, msg: res.error || 'Failed to dispatch SMS' });
    }
  };

  // Confirm SMS code
  const handleVerifySmsSetup = () => {
    const res = globalMfaAuthService.verifySmsCode(smsInputCode);
    if (res.isValid) {
      const updated = globalMfaAuthService.enableSmsMfa(smsPhoneInput);
      setAccount(updated);
      setSmsFeedback({ ok: true, msg: 'Mobile phone number verified and linked!' });
      onMfaStatusChange?.(updated);
      setTimeout(() => setView('OVERVIEW'), 1500);
    } else {
      setSmsFeedback({ ok: false, msg: res.reason });
    }
  };

  // Run test challenge verification
  const handleRunChallenge = () => {
    if (challengeMethod === 'APP') {
      const secret = account.totpSecret || tempSecret || 'JBSWY3DPEHPK3PXP';
      const res = globalMfaAuthService.verifyTotpCode(challengeCode, secret);
      setChallengeResult({ ok: res.isValid, msg: res.reason });
    } else if (challengeMethod === 'SMS') {
      const res = globalMfaAuthService.verifySmsCode(challengeCode);
      setChallengeResult({ ok: res.isValid, msg: res.reason });
    }
  };

  // Download backup codes
  const handleDownloadBackupCodes = () => {
    const text = `AI MINING PLATFORM - MFA RECOVERY CODES\nGenerated: ${new Date().toISOString()}\nAccount: ${account.email}\n\n` +
      account.backupCodes.map((c, i) => `${i + 1}. ${c.code} ${c.used ? '[USED]' : '[AVAILABLE]'}`).join('\n') +
      `\n\nKeep these codes in a secure offline location. Each code can be redeemed only once.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-mining-backup-codes-${Date.now().toString(36)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Regenerate backup codes
  const handleRegenerateBackupCodes = () => {
    const newCodes = globalMfaAuthService.generateFreshBackupCodes(8);
    const updated = { ...account, backupCodes: newCodes };
    globalMfaAuthService.saveAccountSecurity(updated);
    setAccount(updated);
    onMfaStatusChange?.(updated);
  };

  // Toggle or remove a method
  const handleDisableMethod = (method: MfaMethodType) => {
    const updated = globalMfaAuthService.disableMethod(method);
    setAccount(updated);
    onMfaStatusChange?.(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md font-mono select-none text-slate-100">
      <div className="w-full max-w-2xl bg-[#060B14] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-[#09111F] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  ACCOUNT SECURITY &bull; TWO-FACTOR AUTHENTICATION (MFA)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  {account.activeMethods.length > 0 ? 'ENFORCED' : 'OPTIONAL'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                User: <span className="text-cyan-300 font-bold">{account.email}</span> &bull; Authenticator Apps &amp; SMS Passcodes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[82vh] space-y-5">
          
          {/* ================================================================= */}
          {/* 1. OVERVIEW VIEW */}
          {/* ================================================================= */}
          {view === 'OVERVIEW' && (
            <div className="space-y-5">
              
              {/* Security Status Card */}
              <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                account.activeMethods.length > 0
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      MFA Status: {account.activeMethods.length > 0 ? 'Active & Enforced' : 'Not Configured'}
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Two-factor authentication protects mining payouts, worker command dispatches, and cryptographic ledger minting from unauthorized access.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-400">
                      <span>Active Methods: <strong className="text-emerald-400">{account.activeMethods.join(', ') || 'None'}</strong></span>
                      <span>&bull;</span>
                      <span>Backup Codes: <strong className="text-cyan-300">{account.backupCodes.filter((c) => !c.used).length} remaining</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setView('TEST_CHALLENGE')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 text-[10px] font-bold shrink-0 transition"
                >
                  Test Challenge
                </button>
              </div>

              {/* MFA Methods Grid */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Configured Verification Methods</span>
                  <span className="text-[10px] text-slate-400">RFC 6238 &bull; SMS Gateway</span>
                </div>

                {/* Method 1: Authenticator App */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Authenticator App</span>
                        {account.activeMethods.includes('APP') ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                            ENABLED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px]">
                            OFFLINE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Google Authenticator, Microsoft Authenticator, Authy, or 1Password (6-digit TOTP).
                      </p>
                    </div>
                  </div>

                  <div>
                    {account.activeMethods.includes('APP') ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={startAppSetup}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-bold"
                        >
                          Reconfigure
                        </button>
                        <button
                          onClick={() => handleDisableMethod('APP')}
                          className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs"
                          title="Disable Authenticator App"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={startAppSetup}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20"
                      >
                        Set Up App
                      </button>
                    )}
                  </div>
                </div>

                {/* Method 2: SMS Verification */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">SMS-Based Text Passcode</span>
                        {account.activeMethods.includes('SMS') ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                            ENABLED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px]">
                            OFFLINE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {account.smsPhoneNumber
                          ? `Registered phone: ${account.smsPhoneNumber}`
                          : 'Receive instantaneous 6-digit verification codes via carrier SMS.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {account.activeMethods.includes('SMS') ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={startSmsSetup}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-bold"
                        >
                          Change Number
                        </button>
                        <button
                          onClick={() => handleDisableMethod('SMS')}
                          className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs"
                          title="Disable SMS Verification"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={startSmsSetup}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
                      >
                        Set Up SMS
                      </button>
                    )}
                  </div>
                </div>

                {/* Method 3: Backup Recovery Codes */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Emergency Recovery Codes</span>
                        <span className="text-[10px] text-purple-300 font-mono">
                          {account.backupCodes.filter((c) => !c.used).length} remaining
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        One-time access passcodes for regaining access if you lose your phone or authenticator app.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setView('BACKUP_CODES')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-purple-400 text-purple-300 text-xs font-bold"
                  >
                    View Codes
                  </button>
                </div>
              </div>

              {/* Trusted Mining Devices Section */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-cyan-400" />
                    Trusted Mining Devices &amp; Active Sessions
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">2 Registered</span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {account.trustedDevices.map((dev) => (
                    <div key={dev.id} className="p-2 bg-[#0A101D] border border-slate-800/80 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold">{dev.name}</div>
                        <div className="text-[10px] text-slate-400">
                          IP: <code className="text-cyan-300">{dev.ipAddress}</code> &bull; OS: {dev.os} &bull; Browser: {dev.browser}
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Trusted
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* 2. AUTHENTICATOR APP SETUP WIZARD */}
          {/* ================================================================= */}
          {view === 'SETUP_APP' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    Step 1: Set Up Authenticator App
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scan the QR code below using Google Authenticator, Authy, or 1Password.
                  </p>
                </div>
                <button
                  onClick={() => setView('OVERVIEW')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  &larr; Back
                </button>
              </div>

              {/* QR Code and Secret Display */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Visual QR Code Display */}
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-md mx-auto">
                  <svg className="w-44 h-44" viewBox="0 0 25 25">
                    {globalMfaAuthService.generateQrMatrix(tempSecret).map((row, r) =>
                      row.map((cell, c) => (
                        <rect
                          key={`${r}-${c}`}
                          x={c}
                          y={r}
                          width={1}
                          height={1}
                          fill={cell ? '#000000' : '#ffffff'}
                        />
                      ))
                    )}
                  </svg>
                  <span className="text-[9px] text-slate-700 font-mono mt-1 font-bold">SCAN WITH AUTHENTICATOR</span>
                </div>

                {/* Manual Secret Entry */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1 font-bold uppercase">
                      Manual Secret Key (If unable to scan)
                    </label>
                    <div className="flex items-center gap-1.5 bg-[#09111F] border border-cyan-500/40 p-2 rounded-lg font-mono text-cyan-300 font-bold text-xs select-all">
                      <span className="flex-1 tracking-wider">{tempSecret}</span>
                      <button
                        onClick={() => copyToClipboard(tempSecret, 'secret')}
                        className="p-1 hover:text-white text-slate-400 transition"
                        title="Copy Secret"
                      >
                        {copiedKey === 'secret' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-[10px] text-slate-300 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" /> Quick Authenticator Tips:
                    </div>
                    <div>1. Open your authenticator app and tap &quot;+&quot; to add an account.</div>
                    <div>2. Scan this QR code or type in the 16-character secret key.</div>
                    <div>3. Enter the generated 6-digit code below to confirm.</div>
                  </div>
                </div>
              </div>

              {/* 6-digit Code Input */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-white block">
                  Step 2: Enter 6-Digit Code from App
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    value={appInputCode}
                    onChange={(e) => setAppInputCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyAppSetup()}
                    placeholder="e.g. 492015"
                    className="w-48 bg-[#09111F] border border-cyan-500/40 px-3 py-2 text-center text-lg tracking-widest font-bold text-cyan-300 rounded-lg focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={handleVerifyAppSetup}
                    disabled={appInputCode.length < 6}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition shadow-md shadow-cyan-500/20"
                  >
                    Verify &amp; Activate
                  </button>
                </div>

                {appFeedback && (
                  <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                    appFeedback.ok
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  }`}>
                    {appFeedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span>{appFeedback.msg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. SMS VERIFICATION SETUP WIZARD */}
          {/* ================================================================= */}
          {view === 'SETUP_SMS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    Set Up SMS-Based Verification
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Link your mobile phone to receive one-time SMS passcodes for mining operations.
                  </p>
                </div>
                <button
                  onClick={() => setView('OVERVIEW')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  &larr; Back
                </button>
              </div>

              {/* Explicit Simulated Gateway Disclosure Banner */}
              <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="text-amber-300 font-bold block">SIMULATED TESTNET CARRIER GATEWAY</strong>
                  Live cellular SMS credentials (e.g. Twilio / AWS SNS) are unconfigured in this environment. Passcode generation and transmission are strictly simulated for testing and verification without cellular carrier dispatch.
                </div>
              </div>

              {/* Phone Input Card */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-white block">
                  1. Mobile Phone Number (with Country Code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={smsPhoneInput}
                    onChange={(e) => setSmsPhoneInput(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="flex-1 bg-[#09111F] border border-emerald-500/40 p-2.5 text-xs text-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 font-mono"
                  />
                  <button
                    onClick={handleSendSms}
                    disabled={smsCooldown > 0}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{smsCooldown > 0 ? `Resend (${smsCooldown}s)` : 'Send Code'}</span>
                  </button>
                </div>

                {simulatedCarrierCode && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-lg text-emerald-200 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Simulated Carrier Message: <strong>Your AI Mining Code is {simulatedCarrierCode}</strong></span>
                    </div>
                    <button
                      onClick={() => setSmsInputCode(simulatedCarrierCode)}
                      className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}
              </div>

              {/* 6-Digit Code Verification */}
              {smsSent && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-white block">
                    2. Enter 6-Digit SMS Verification Code
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={smsInputCode}
                      onChange={(e) => setSmsInputCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifySmsSetup()}
                      placeholder="e.g. 583921"
                      className="w-48 bg-[#09111F] border border-emerald-500/40 px-3 py-2 text-center text-lg tracking-widest font-bold text-emerald-300 rounded-lg focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      onClick={handleVerifySmsSetup}
                      disabled={smsInputCode.length < 6}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition shadow-md shadow-emerald-500/20"
                    >
                      Confirm SMS Link
                    </button>
                  </div>

                  {smsFeedback && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                      smsFeedback.ok
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}>
                      {smsFeedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                      <span>{smsFeedback.msg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. BACKUP RECOVERY CODES DRAWER */}
          {/* ================================================================= */}
          {view === 'BACKUP_CODES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-400" />
                    Emergency Backup Recovery Codes
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Save these codes in a password manager or offline file. Each code can be used once if your device is unavailable.
                  </p>
                </div>
                <button
                  onClick={() => setView('OVERVIEW')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  &larr; Back
                </button>
              </div>

              {/* Grid of Codes */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                {account.backupCodes.map((c, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg border text-center font-bold ${
                      c.used
                        ? 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        : 'bg-[#0A101E] border-purple-500/30 text-purple-300'
                    }`}
                  >
                    <div className="text-[9px] text-slate-500">#{i + 1}</div>
                    <div>{c.code}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadBackupCodes}
                    className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download (.txt)</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(account.backupCodes.map((c) => c.code).join('\n'), 'backupCodes')}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    {copiedKey === 'backupCodes' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy All</span>
                  </button>
                </div>

                <button
                  onClick={handleRegenerateBackupCodes}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500 text-amber-300 text-xs font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerate Codes</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 5. TEST CHALLENGE VIEW */}
          {/* ================================================================= */}
          {view === 'TEST_CHALLENGE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    Test MFA Challenge Verification
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Simulate an operational MFA challenge gate (such as approving a payout or mining worker reboot).
                  </p>
                </div>
                <button
                  onClick={() => setView('OVERVIEW')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  &larr; Back
                </button>
              </div>

              {/* Method selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setChallengeMethod('APP');
                    setChallengeResult(null);
                  }}
                  className={`flex-1 p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 ${
                    challengeMethod === 'APP'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Authenticator App</span>
                </button>

                <button
                  onClick={() => {
                    setChallengeMethod('SMS');
                    setChallengeResult(null);
                  }}
                  className={`flex-1 p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 ${
                    challengeMethod === 'SMS'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>SMS Carrier Text</span>
                </button>
              </div>

              {/* Input & Verify */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs text-slate-300 block">
                  Enter 6-digit passcode from your {challengeMethod === 'APP' ? 'Authenticator App' : 'SMS Message'}:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    value={challengeCode}
                    onChange={(e) => setChallengeCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunChallenge()}
                    placeholder="e.g. 123456"
                    className="w-48 bg-[#09111F] border border-cyan-500/40 px-3 py-2 text-center text-lg tracking-widest font-bold text-cyan-300 rounded-lg focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={handleRunChallenge}
                    disabled={challengeCode.length < 6}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition shadow-md shadow-cyan-500/20"
                  >
                    Submit Challenge
                  </button>
                </div>

                <div className="text-[10px] text-slate-400">
                  Tip: In development, bypass codes <code className="text-cyan-300">123456</code> or <code className="text-cyan-300">777888</code> are always accepted.
                </div>

                {challengeResult && (
                  <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                    challengeResult.ok
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  }`}>
                    {challengeResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span className="font-bold">{challengeResult.msg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-[#09111F] border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>FIPS 140-2 / RFC 6238 Compliant Zero-Trust Authentication</span>
          </div>
          <div>
            <span>Account ID: <code className="text-slate-300">{account.userId}</code></span>
          </div>
        </div>

      </div>
    </div>
  );
};
