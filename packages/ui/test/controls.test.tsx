import { fireEvent, render, screen } from '@testing-library/react-native';
import { Icon } from '../src/Icon';
import { icons } from '../src/icons';
import { Button } from '../src/Button';
import { SegmentedControl } from '../src/SegmentedControl';
import { TabBar } from '../src/TabBar';
import { ActionOrb } from '../src/ActionOrb';

describe('Icon', () => {
  it('renders the home path from the design system', async () => {
    await render(<Icon name="home" title="Home" />);
    expect(JSON.stringify(screen.toJSON())).toContain(
      JSON.stringify('M12 3 2.5 11.2H5v9.3h5.2V15h3.6v5.5H19v-9.3h2.5z'),
    );
    expect(icons.home).toHaveLength(1);
    expect(screen.getByLabelText('Home')).toBeTruthy();
  });

  it('keeps evenodd fill rule for icons that need it', () => {
    expect(icons.broom[0]?.fillRule).toBe('evenodd');
  });
});

describe('Button', () => {
  it('calls onPress once', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save task" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Save task'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save task" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByText('Save task'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('ignores presses when loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save task" onPress={onPress} loading />);
    await fireEvent.press(screen.getByText('Save task'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('ActionOrb', () => {
  it('is labelled and pressable', async () => {
    const onPress = jest.fn();
    await render(<ActionOrb label="Start cleaning" onPress={onPress} halo />);
    await fireEvent.press(screen.getByLabelText('Start cleaning'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Mine' },
  ];

  it('calls onChange with the option value and marks the active one selected', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={options} value="all" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'All' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Mine' })).not.toBeSelected();
    await fireEvent.press(screen.getByText('Mine'));
    expect(onChange).toHaveBeenCalledWith('mine');
  });
});

describe('TabBar', () => {
  const items = [
    { id: 'today', label: 'Today', icon: 'home' as const },
    { id: 'rooms', label: 'Rooms', icon: 'spray' as const },
  ];

  it('shows only the active label and switches tabs', async () => {
    const onChange = jest.fn();
    await render(<TabBar items={items} active="today" onChange={onChange} />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.queryByText('Rooms')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Today' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Rooms' }));
    expect(onChange).toHaveBeenCalledWith('rooms');
  });
});
