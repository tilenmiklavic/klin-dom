import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, type IconName } from '@klindom/ui';

const BAR_OFFSET = 22;
const items: { id: string; icon: IconName }[] = [
  { id: 'index', icon: 'home' },
  // TODO(design system): needs a dedicated "room" glyph; `sponge` stands in.
  { id: 'rooms', icon: 'sponge' },
  { id: 'tasks', icon: 'checklist' },
  { id: 'profile', icon: 'profile' },
];
const paths: Record<string, string> = { index: '/', rooms: '/rooms', tasks: '/tasks', profile: '/profile' };

export default function TabsLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      tabBar={({ state }) => {
        const active = state.routes[state.index]?.name.split('/')[0] ?? 'index';
        return (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + BAR_OFFSET, alignItems: 'center', paddingHorizontal: 20 }}
          >
            <View style={{ width: '100%', maxWidth: 480 }}>
              <TabBar
                active={active}
                items={items.map((i) => ({ ...i, label: t(`tabs.${i.id === 'index' ? 'home' : i.id}`) }))}
                onChange={(id) => router.navigate(paths[id]! as '/')}
              />
            </View>
          </View>
        );
      }}
    />
  );
}
