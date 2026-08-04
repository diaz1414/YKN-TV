import { Download, MonitorDown, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { YKN_ANDROID_APK_DOWNLOAD_URL } from '../config/backup';

type BackupSiteNoticeProps = {
    variant?: 'home' | 'watch';
};

const BackupSiteNotice = ({ variant = 'home' }: BackupSiteNoticeProps) => {
    const isWatch = variant === 'watch';

    return (
        <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-[#080808]/80 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
        >
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-amber-500/10 via-red-600/5 to-transparent" />
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                        {isWatch ? <MonitorDown size={20} /> : <Smartphone size={20} />}
                    </div>

                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                                APK Android
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                                Ready
                            </span>
                        </div>

                        <h3 className="mt-1 text-sm md:text-base font-black text-white uppercase tracking-tight">
                            {isWatch ? 'Nonton lebih nyaman lewat aplikasi Android.' : 'Download aplikasi Android YKN TV.'}
                        </h3>

                        <p className="mt-1 text-[11px] md:text-xs text-zinc-400 font-semibold leading-relaxed">
                            {isWatch
                                ? 'Download APK YKN TV dan nikmati akses live lebih praktis langsung dari HP.'
                                : 'Download APK Android YKN TV untuk nonton lebih nyaman lewat HP.'}
                        </p>
                    </div>
                </div>

                <a
                    href={YKN_ANDROID_APK_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all"
                >
                    Download APK
                    <Download size={14} />
                </a>
            </div>
        </motion.div>
    );
};

export default BackupSiteNotice;
