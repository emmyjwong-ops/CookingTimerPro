// All available alarm sounds.
// 'file' must match the filename in android/app/src/main/res/raw/ (without extension).
// 'premium' = true means only available to premium users.

export const ALARM_SOUNDS = [
  {id: 'bell',           label: '🔔 Bell',           file: 'bell',                  premium: false},
  {id: 'digital_beep',  label: '⏰ Digital Beep',    file: 'sound_digital_beep',    premium: true},
  {id: 'soft_chime',    label: '🎵 Soft Chime',      file: 'sound_soft_chime',      premium: true},
  {id: 'kitchen_timer', label: '🕰️ Kitchen Timer',   file: 'sound_kitchen_timer',   premium: true},
  {id: 'gentle_melody', label: '🎶 Gentle Melody',   file: 'sound_gentle_melody',   premium: true},
];

export function getSoundFile(soundId) {
  const sound = ALARM_SOUNDS.find(s => s.id === soundId);
  return sound ? sound.file : 'bell';
}
