import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Rings } from '../src/Rings';
import { TickRing } from '../src/TickRing';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const ring = (over: Partial<Parameters<typeof Rings>[0]['rings'][number]> = {}) => ({
  key: 'today',
  label: 'Today',
  value: 4,
  total: 9,
  color: 'brand' as const,
  ...over,
});

describe('Rings', () => {
  it('renders value and muted total in the legend', async () => {
    await render(<Rings rings={[ring()]} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('/9')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('renders percent units as a single figure', async () => {
    await render(<Rings rings={[ring({ key: 'fresh', value: 86, total: 100, unit: '%' })]} />);
    expect(screen.getByText('86%')).toBeTruthy();
    expect(screen.queryByText('/100')).toBeNull();
  });

  it('draws a ring with total 0 as closed', async () => {
    await render(<Rings rings={[ring({ value: 0, total: 0 })]} />);
    expect(screen.getByLabelText('Today').props.accessibilityValue).toEqual({ now: 1, max: 1 });
  });

  it('exposes value and total on a normal ring', async () => {
    await render(<Rings rings={[ring()]} />);
    expect(screen.getByLabelText('Today').props.accessibilityValue).toEqual({ now: 4, max: 9 });
  });

  it('fires onRingClosed once when a ring crosses to complete, not on mount', async () => {
    const onRingClosed = jest.fn();
    const { rerender } = await render(
      <Rings rings={[ring({ value: 9 })]} onRingClosed={onRingClosed} />,
    );
    expect(onRingClosed).not.toHaveBeenCalled();
    await rerender(<Rings rings={[ring({ value: 8 })]} onRingClosed={onRingClosed} />);
    await rerender(<Rings rings={[ring({ value: 9 })]} onRingClosed={onRingClosed} />);
    expect(onRingClosed).toHaveBeenCalledTimes(1);
    expect(onRingClosed).toHaveBeenCalledWith('today');
    await rerender(<Rings rings={[ring({ value: 9, label: 'Today' })]} onRingClosed={onRingClosed} />);
    expect(onRingClosed).toHaveBeenCalledTimes(1);
  });
});

describe('TickRing', () => {
  it('calls onPress, exposes checked state and fires a light haptic', async () => {
    const onPress = jest.fn();
    await render(<TickRing done={false} onPress={onPress} accessibilityLabel="Mark done" />);
    const el = screen.getByLabelText('Mark done');
    expect(el.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(el);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('reports done as checked', async () => {
    await render(<TickRing done onPress={jest.fn()} accessibilityLabel="Done" />);
    expect(screen.getByLabelText('Done').props.accessibilityState).toMatchObject({ checked: true });
  });
});
