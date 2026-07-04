type IndonesianTimeZone = 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';

const WIB_TIME_ZONE: IndonesianTimeZone = 'Asia/Jakarta';

const getUserIndonesianTimeZone = (): IndonesianTimeZone => {
  const browserTimeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : '';

  if (browserTimeZone === 'Asia/Makassar' || browserTimeZone === 'Asia/Ujung_Pandang') {
    return 'Asia/Makassar';
  }

  if (browserTimeZone === 'Asia/Jayapura') {
    return 'Asia/Jayapura';
  }

  if (browserTimeZone === 'Asia/Jakarta' || browserTimeZone === 'Asia/Pontianak') {
    return WIB_TIME_ZONE;
  }

  const offsetHours = -new Date().getTimezoneOffset() / 60;
  if (offsetHours === 8) return 'Asia/Makassar';
  if (offsetHours === 9) return 'Asia/Jayapura';

  return WIB_TIME_ZONE;
};

export const normalizeJadwalInput = (dateStr?: string): string => {
  if (!dateStr) return '';

  let clean = dateStr.trim().replace(/\s+/, 'T');

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return `${clean}T00:00:00+07:00`;
  }

  if (/T.*[+-]\d{2}\d{2}$/.test(clean)) {
    clean = clean.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  }

  if (/T.*[+-]\d{2}$/.test(clean)) {
    clean = clean.replace(/([+-]\d{2})$/, '$1:00');
  }

  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(clean);
  return hasTimeZone ? clean : `${clean}+07:00`;
};

export const parseJadwalDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  return new Date(normalizeJadwalInput(dateStr));
};

const formatDateKey = (date: Date, timeZone: IndonesianTimeZone): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const formatMatchTimeForUserZone = (date: Date): string => {
  if (isNaN(date.getTime())) return '';

  const timeZone = getUserIndonesianTimeZone();
  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });

  if (formatDateKey(date, timeZone) === formatDateKey(new Date(), timeZone)) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone,
  });

  return `${dateStr} - ${timeStr}`;
};

export const formatJadwalDateTimeForUserZone = (jadwal?: string): string => {
  if (!jadwal) return '';

  const date = parseJadwalDate(jadwal);
  if (isNaN(date.getTime())) return jadwal;

  return date.toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: getUserIndonesianTimeZone(),
  });
};

const getDateTimeParts = (date: Date, timeZone: IndonesianTimeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export const formatDateTimeLocalInWib = (date: Date): string => {
  if (isNaN(date.getTime())) return '';

  const parts = getDateTimeParts(date, WIB_TIME_ZONE);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
