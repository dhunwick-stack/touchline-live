export function getLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getLocalTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

export function splitIsoToLocalDateTime(isoString: string | null | undefined) {
  if (!isoString) {
    return {
      date: '',
      time: '',
    };
  }

  const date = new Date(isoString);
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - tzOffset);
  const isoLocal = localDate.toISOString().slice(0, 16);

  return {
    date: isoLocal.slice(0, 10),
    time: isoLocal.slice(11, 16),
  };
}

export function combineLocalDateAndTime(date: string, time: string) {
  if (!date.trim()) return null;

  const normalizedTime = time.trim() || '00:00';
  return new Date(`${date}T${normalizedTime}`).toISOString();
}
