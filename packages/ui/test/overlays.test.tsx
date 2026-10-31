import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Sheet } from '../src/Sheet';
import { ToastProvider, useToast } from '../src/Toast';
import { Celebration } from '../src/Celebration';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('Sheet', () => {
  it('renders title, children and footer; backdrop closes', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Sheet visible onClose={onClose} title="Reminder" footer={<Text>Footer</Text>}>
          <Text>Body</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Reminder')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Footer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Sheet visible={false} onClose={jest.fn()} title="Hidden">
          <Text>Body</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(screen.queryByText('Body')).toBeNull();
  });
});

function Trigger({ onAction, durationMs }: { onAction: () => void; durationMs?: number }) {
  const toast = useToast();
  return (
    <Text
      onPress={() =>
        toast.show({ message: 'Task removed', action: { label: 'Undo', onPress: onAction }, durationMs })
      }
    >
      go
    </Text>
  );
}

function renderToast(props: { onAction: () => void; durationMs?: number }) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastProvider>
        <Trigger {...props} />
      </ToastProvider>
    </SafeAreaProvider>,
  );
}

describe('Toast', () => {
  it('shows message and action; pressing the action calls it and hides the toast', async () => {
    const onAction = jest.fn();
    await renderToast({ onAction });
    await fireEvent.press(screen.getByText('go'));
    expect(screen.getByText('Task removed')).toBeTruthy();
    await fireEvent.press(screen.getByText('Undo'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Task removed')).toBeNull();
  });

  it('auto-hides after 4000 ms by default', async () => {
    await renderToast({ onAction: jest.fn() });
    await fireEvent.press(screen.getByText('go'));
    await act(async () => {
      jest.advanceTimersByTime(3999);
    });
    expect(screen.getByText('Task removed')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Task removed')).toBeNull();
  });

  it('honours durationMs', async () => {
    await renderToast({ onAction: jest.fn(), durationMs: 10000 });
    await fireEvent.press(screen.getByText('go'));
    await act(async () => {
      jest.advanceTimersByTime(9999);
    });
    expect(screen.getByText('Task removed')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Task removed')).toBeNull();
  });
});

describe('Celebration', () => {
  it('fires success haptics and calls onDone after the burst', async () => {
    const onDone = jest.fn();
    await render(<Celebration visible onDone={onDone} />);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does nothing when not visible', async () => {
    const onDone = jest.fn();
    await render(<Celebration visible={false} onDone={onDone} />);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
