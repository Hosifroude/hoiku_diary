export function compactQueue(queue, task) {
  if (task.password || task.apiKey || task.invite_code) return { queue, queued: false };
  let next = [...queue];
  if (task.action === 'delete') {
    const before = next.length;
    next = next.filter(x => !(x.action === 'save' && x.event?.id === task.id));
    if (next.length < before) return { queue: next, queued: true };
  }
  const duplicate = task.action === 'save'
    ? next.some(x => x.action === 'save' && x.event?.id === task.event?.id)
    : next.some(x => JSON.stringify(x) === JSON.stringify(task));
  if (!duplicate) next.push(task);
  return { queue: next, queued: true };
}
export function mergePendingEvents(serverEvents, queue, targetDate) {
  let merged = [...serverEvents];
  for (const task of queue) {
    if (task.action === 'save' && task.event?.date === targetDate && !merged.some(e => e.id === task.event.id)) merged.push(task.event);
    if (task.action === 'delete' && task.date === targetDate) merged = merged.filter(e => e.id !== task.id);
  }
  return merged;
}
export function canSelectDate(dateKey, todayKey) { return dateKey <= todayKey; }
export function renderableDays(year, monthZero, todayKey) {
  const last = new Date(year, monthZero + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => { const day = i + 1; const key = `${year}-${String(monthZero + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; return { day, key, disabled: !canSelectDate(key, todayKey) }; });
}
