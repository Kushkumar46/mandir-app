import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { MandirFlag } from '@mandir/shared-types';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useFlag } from '@/features/config/flags';
import { useTabBarStore } from '@/features/shell/tabBar';
import { colors, fontFamily } from '@/theme';

/** Bottom tabs (Mandir + Profile in Phase 1); a tab whose module flag is off is hidden. Full-screen modes hide the bar. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const mandirEnabled = useFlag(MandirFlag.ENABLED);
  const tabBarHidden = useTabBarStore((s) => s.hidden);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.maroon,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: tabBarHidden ? { display: 'none' } : { backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.bold, fontSize: 13 },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen
        name="mandir/index"
        options={{
          title: t('tabs.mandir'),
          href: mandirEnabled ? '/mandir' : null,
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="temple-hindu" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
