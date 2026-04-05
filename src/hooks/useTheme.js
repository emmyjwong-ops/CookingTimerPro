import {Colors} from '../constants/colors';
import {DarkColors} from '../constants/darkColors';
import {useSettings} from '../context/SettingsContext';

export function useTheme() {
  const {settings} = useSettings();

  const isDark = settings.darkMode === 'dark';

  return isDark ? DarkColors : Colors;
}
