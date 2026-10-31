import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { iconNames, localDate, type MemberDto, type RoomDto, type TaskDto } from '@klindom/shared';
import { Button, ChoiceChips, KText, Screen, Sheet, TextField, tokens, useToast } from '@klindom/ui';
import { Field } from '../src/components/tasks/Field';
import { FrequencyField } from '../src/components/tasks/FrequencyField';
import { ReminderPicker } from '../src/components/tasks/ReminderPicker';
import { useHome, useMembers, useRooms } from '../src/data/homes';
import { useArchiveTask, useCreateTask, useTask, useUpdateTask } from '../src/data/tasks';
import { useCurrentHome } from '../src/state/currentHome';
import { normalizeKeys } from '../src/tasks/reminders';
import { blankForm, buildCreate, buildPatch, formFromTask, isValidDate, TIME_RE, type FormState } from '../src/tasks/form';

const HOUSEHOLD = 'household';

/** Create (no `id`) or edit (`?id=`) a task. Waits for what the form is seeded from, then mounts the form. */
export default function TaskEditor() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const rooms = useRooms(homeId);
  const members = useMembers(homeId);
  const task = useTask(id);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const today = home.data ? localDate(new Date(Date.now()), home.data.timezone) : null;
  const ready = today && rooms.data && (!id || task.data);

  return (
    <Screen
      title={t(id ? 'editor.editTitle' : 'editor.newTitle')}
      right={<Button variant="chip" label={t('common.close')} onPress={close} />}
    >
      {ready ? (
        <EditorForm
          key={task.data?.id ?? 'new'}
          homeId={homeId}
          today={today}
          task={task.data}
          rooms={rooms.data!}
          members={members.data ?? []}
          initial={task.data ? formFromTask(task.data, today) : blankForm(today)}
          close={close}
        />
      ) : id && task.isError ? (
        <KText variant="body" color="inkMuted">
          {t('editor.loadFailed')}
        </KText>
      ) : null}
    </Screen>
  );
}

interface FormProps {
  homeId: string | null;
  today: string;
  task?: TaskDto;
  rooms: RoomDto[];
  members: MemberDto[];
  initial: FormState;
  close: () => void;
}

type Errors = Partial<Record<'name' | 'rooms' | 'date' | 'time', string>>;

function EditorForm({ homeId, today, task, rooms, members, initial, close }: FormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState<'menu' | 'confirm' | null>(null);
  const create = useCreateTask(homeId);
  const update = useUpdateTask(homeId, task?.id ?? '');
  const archive = useArchiveTask(homeId, task?.id ?? '');
  const saving = create.isPending || update.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors({});
  };

  const validate = (): Errors => ({
    ...(form.name.trim() ? {} : { name: t('editor.nameRequired') }),
    ...(form.roomIds.length > 0 ? {} : { rooms: t('editor.roomsRequired') }),
    ...(task || isValidDate(form.startDate) ? {} : { date: t('editor.dateInvalid') }),
    ...(!form.dueTime || TIME_RE.test(form.dueTime) ? {} : { time: t('editor.timeInvalid') }),
  });

  const save = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      if (task) {
        const patch = buildPatch(form, task);
        if (Object.keys(patch).length > 0) await update.mutateAsync(patch);
      } else {
        await create.mutateAsync(buildCreate(form, today));
      }
    } catch {
      toast.show({ message: t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t(task ? 'editor.saved' : 'editor.added') });
    close();
  };

  const doArchive = async () => {
    setSheet(null); // a toast hides beneath an open sheet
    try {
      await archive.mutateAsync();
    } catch {
      toast.show({ message: t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t('editor.archived') });
    router.dismissTo('/tasks');
  };

  return (
    <View style={{ gap: tokens.space[5] }}>
      <TextField label={t('editor.name')} value={form.name} onChangeText={(v) => set('name', v)} error={errors.name} maxLength={60} />
      <Field label={t('editor.icon')}>
        <ChoiceChips
          value={form.icon}
          options={iconNames.map((n) => ({ value: n, label: t(`icons.${n}`) }))}
          onChange={(v) => set('icon', v as FormState['icon'])}
        />
      </Field>
      <Field label={t('editor.rooms')} error={errors.rooms}>
        <ChoiceChips
          multiple
          value={form.roomIds}
          options={rooms.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(v) => set('roomIds', v as string[])}
        />
      </Field>
      <Field label={t('editor.repeats')}>
        <FrequencyField
          count={form.count}
          unit={form.unit}
          onChange={(count, unit) => {
            setForm((f) => ({ ...f, count, unit }));
            setErrors({});
          }}
        />
      </Field>
      {task ? null : (
        <TextField
          label={t('editor.startDate')}
          value={form.startDate}
          onChangeText={(v) => set('startDate', v.trim())}
          error={errors.date}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      )}
      <TextField
        label={t('editor.dueTime')}
        value={form.dueTime}
        onChangeText={(v) => {
          const dueTime = v.trim();
          setForm((f) => ({ ...f, dueTime, reminderKeys: normalizeKeys(f.reminderKeys, TIME_RE.test(dueTime) ? dueTime : null) }));
          setErrors({});
        }}
        error={errors.time}
        placeholder={t('editor.anyTime')}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
      <Field label={t('editor.assignee')}>
        <ChoiceChips
          value={form.assigneeId ?? HOUSEHOLD}
          options={[
            { value: HOUSEHOLD, label: t('editor.household') },
            ...members.map((m) => ({ value: m.userId, label: m.displayName ?? t('detail.unknownMember') })),
          ]}
          onChange={(v) => set('assigneeId', v === HOUSEHOLD ? null : (v as string))}
        />
      </Field>
      <Field label={t('editor.reminders')}>
        <ReminderPicker
          value={form.reminderKeys}
          dueTime={TIME_RE.test(form.dueTime) ? form.dueTime : null}
          extraOffsets={form.extraOffsets}
          onChange={(keys) => set('reminderKeys', keys)}
        />
      </Field>
      <TextField label={t('editor.notes')} value={form.notes} onChangeText={(v) => set('notes', v)} maxLength={500} multiline />
      <Button label={t('editor.save')} loading={saving} onPress={() => void save()} />
      {task ? <Button variant="secondary" label={t('editor.menu')} onPress={() => setSheet('menu')} /> : null}
      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={t('editor.menu')} closeLabel={t('common.close')}>
        <Button variant="secondary" label={t('editor.archive')} onPress={() => setSheet('confirm')} />
      </Sheet>
      <Sheet visible={sheet === 'confirm'} onClose={() => setSheet(null)} title={t('editor.archiveTitle')} closeLabel={t('common.close')}>
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {t('editor.archiveBody')}
          </KText>
          <Button label={t('editor.archive')} loading={archive.isPending} onPress={() => void doArchive()} />
          <Button variant="secondary" label={t('editor.keep')} onPress={() => setSheet(null)} />
        </View>
      </Sheet>
    </View>
  );
}
