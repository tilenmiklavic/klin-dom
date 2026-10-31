import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { TaskRow } from '../src/TaskRow';
import { RoomCard } from '../src/RoomCard';
import { Avatar } from '../src/Avatar';
import { MemberBars } from '../src/MemberBars';
import { ListGroup, ListRow } from '../src/ListGroup';
import { ChoiceChips } from '../src/ChoiceChips';
import { EmptyState } from '../src/EmptyState';
import { TextField } from '../src/TextField';
import { StatCard } from '../src/StatCard';
import { Screen } from '../src/Screen';
import { GoalCard } from '../src/GoalCard';
import { QuickAction } from '../src/QuickAction';
import { ProgressArcs } from '../src/ProgressArcs';
import { TaskChip } from '../src/TaskChip';
import { InsightCard } from '../src/InsightCard';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const NAME = 'Clean windows and window sills';
const CAPTION = "Kids' bedroom upstairs, Living room +2";

describe('TaskRow', () => {
  const base = { icon: 'window' as const, name: NAME, caption: CAPTION, onPress: jest.fn() };

  it('keeps long text on one line and the tick ring in place at 320 wide', async () => {
    await render(
      <View style={{ width: 320 }}>
        <TaskRow {...base} done={false} onToggle={jest.fn()} />
      </View>,
    );
    expect(screen.getByText(NAME).props.numberOfLines).toBe(1);
    expect(screen.getByText(CAPTION).props.numberOfLines).toBe(1);
    expect(screen.getByTestId('task-row-text')).toHaveStyle({ flex: 1, minWidth: 0 });
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('strikes the name through in muted ink when done', async () => {
    await render(<TaskRow {...base} done onToggle={jest.fn()} />);
    expect(screen.getByText(NAME)).toHaveStyle({
      textDecorationLine: 'line-through',
      color: '#5c5c5c',
    });
  });

  it('colors a due caption in brandStrong', async () => {
    await render(<TaskRow {...base} captionTone="due" done={false} onToggle={jest.fn()} />);
    expect(screen.getByText(CAPTION)).toHaveStyle({ color: '#b84424' });
  });

  it('toggles from the tick ring, but not while busy', async () => {
    const onToggle = jest.fn();
    const { rerender } = await render(<TaskRow {...base} done={false} onToggle={onToggle} />);
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    await rerender(<TaskRow {...base} done={false} onToggle={onToggle} busy />);
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the assignee initial', async () => {
    await render(
      <TaskRow {...base} assignee={{ initial: 'b' }} done={false} onToggle={jest.fn()} />,
    );
    expect(screen.getByText('B')).toBeTruthy();
  });
});

describe('RoomCard', () => {
  const props = {
    icon: 'home' as const,
    name: 'Living room',
    freshness: 0.6,
    status: 'Due today',
    onPress: jest.fn(),
  };

  it('truncates the name to one line', async () => {
    await render(<RoomCard {...props} />);
    expect(screen.getByText('Living room').props.numberOfLines).toBe(1);
  });

  it('colors a due status brandStrong', async () => {
    await render(<RoomCard {...props} statusTone="due" />);
    expect(screen.getByText('Due today')).toHaveStyle({ color: '#b84424' });
  });

  it('presses', async () => {
    const onPress = jest.fn();
    await render(<RoomCard {...props} onPress={onPress} />);
    await fireEvent.press(screen.getByText('Living room'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Avatar', () => {
  it('shows the uppercase first letter, or ? for null', async () => {
    await render(
      <>
        <Avatar name="ana" />
        <Avatar name={null} />
      </>,
    );
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('?')).toBeTruthy();
  });
});

describe('StatCard', () => {
  it('renders label, value and unit', async () => {
    await render(<StatCard label="This week" value="12" unit="chores" />);
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('chores')).toBeTruthy();
  });

  it('uses the night surface for the night tone', async () => {
    await render(<StatCard label="L" value="1" tone="night" />);
    expect(screen.getByTestId('stat-card')).toHaveStyle({ backgroundColor: '#3d3d3d' });
  });
});

describe('MemberBars', () => {
  it('colors the first bar brand, others ink, and normalises to the max', async () => {
    await render(
      <MemberBars
        rows={[
          { name: 'Ana', value: 10 },
          { name: 'Bo', value: 5 },
        ]}
      />,
    );
    expect(screen.getByTestId('member-bar-fill-0')).toHaveStyle({
      backgroundColor: '#e2643f',
      height: '100%',
    });
    expect(screen.getByTestId('member-bar-fill-1')).toHaveStyle({
      backgroundColor: '#141414',
      height: '50%',
    });
  });
});

describe('ListGroup', () => {
  it('renders title and rows, destructive label in brandStrong', async () => {
    const onPress = jest.fn();
    await render(
      <ListGroup title="Account">
        <ListRow label="Name" value="Ana" />
        <ListRow label="Leave household" destructive onPress={onPress} />
      </ListGroup>,
    );
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Leave household')).toHaveStyle({ color: '#b84424' });
    expect(screen.getByText('Name')).toHaveStyle({ color: '#141414' });
    await fireEvent.press(screen.getByText('Leave household'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ChoiceChips', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];

  it('toggles values in and out when multiple', async () => {
    const onChange = jest.fn();
    function Host() {
      const [v, setV] = useState<string[]>([]);
      return (
        <ChoiceChips
          options={options}
          multiple
          value={v}
          onChange={(n) => {
            onChange(n);
            setV(n as string[]);
          }}
        />
      );
    }
    await render(<Host />);
    await fireEvent.press(screen.getByText('A'));
    await fireEvent.press(screen.getByText('B'));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await fireEvent.press(screen.getByText('A'));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });

  it('selects a single value', async () => {
    const onChange = jest.fn();
    await render(<ChoiceChips options={options} value="a" onChange={onChange} />);
    await fireEvent.press(screen.getByText('B'));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('radio', { name: 'A' })).toBeSelected();
  });
});

describe('EmptyState', () => {
  it('renders copy and an action', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        icon="checklist"
        title="No tasks yet"
        body="Add your first task."
        action={{ label: 'Add task', onPress }}
      />,
    );
    expect(screen.getByText('No tasks yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add task'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('TextField', () => {
  it('reports changes and shows the error', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField label="Name" value="" onChangeText={onChangeText} error="Required" />,
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Ana');
    expect(onChangeText).toHaveBeenCalledWith('Ana');
    expect(screen.getByText('Required')).toHaveStyle({ color: '#b84424' });
  });

  it('draws a 2px ink focus ring', async () => {
    await render(<TextField label="Name" value="" onChangeText={jest.fn()} />);
    await fireEvent(screen.getByLabelText('Name'), 'focus');
    expect(screen.getByTestId('text-field-box').props.style).toEqual(
      expect.objectContaining({ boxShadow: expect.stringContaining('0 0 0 2px #141414') }),
    );
  });
});

describe('Screen', () => {
  const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  it('pads for the top safe area and renders title and content', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Screen title="Today">
          <View testID="child" />
        </Screen>
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByTestId('screen-root')).toHaveStyle({
      paddingTop: 47,
      backgroundColor: '#f2f2f2',
    });
    expect(screen.getByTestId('screen-content')).toHaveStyle({ maxWidth: 480 });
  });

  it('renders without a scroll view when scroll is false', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Screen scroll={false}>
          <View testID="child" />
        </Screen>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.queryByTestId('screen-scroll')).toBeNull();
  });
});

describe('design-system parity', () => {
  it('GoalCard shows the default title and fires the action', async () => {
    const onAction = jest.fn();
    await render(<GoalCard
        title="3 of 9 chores done today"
        actionLabel="Start cleaning"
        value={3}
        goal={9}
        onAction={onAction}
      />);
    expect(screen.getByText('3 of 9 chores done today')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Start cleaning'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('QuickAction presses', async () => {
    const onPress = jest.fn();
    await render(<QuickAction icon="spray" label="Spray" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Spray'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ProgressArcs lists each item value', async () => {
    await render(
      <ProgressArcs
        items={[
          { label: 'Today', value: 4, goal: 9 },
          { label: 'Week', value: 10, goal: 20, unit: 'chores' },
        ]}
      />,
    );
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('4/9')).toBeTruthy();
    expect(screen.getByText('10/20')).toBeTruthy();
  });

  it('TaskChip strikes the value through when done', async () => {
    await render(<TaskChip label="Kitchen" value="Mop floor" done progress={1} />);
    expect(screen.getByText('Mop floor')).toHaveStyle({ textDecorationLine: 'line-through' });
  });

  it('InsightCard fires both actions', async () => {
    const onDismiss = jest.fn();
    const onAction = jest.fn();
    await render(
      <InsightCard
        dismissLabel="Dismiss"
        actionLabel="Add to routine"
        onDismiss={onDismiss}
        onAction={onAction}
      >
        Vacuum twice a week
      </InsightCard>,
    );
    expect(screen.getByText('Vacuum twice a week')).toBeTruthy();
    await fireEvent.press(screen.getByText('Dismiss'));
    await fireEvent.press(screen.getByText('Add to routine'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
