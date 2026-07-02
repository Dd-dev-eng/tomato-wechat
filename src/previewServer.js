require('dotenv').config();
const express = require('express');
const path = require('path');
const { connectPreviewDB } = require('./config/previewDatabase');
const userService = require('./services/userService');
const activityPoolService = require('./services/activityPoolService');
const activityService = require('./services/activityService');
const sessionService = require('./services/sessionService');
const { formatDuration } = require('./utils/dateHelper');

const app = express();
const PORT = process.env.PREVIEW_PORT || 4000;
const DEFAULT_ACTIVITIES = ['阅读', '学习', '运动'];
const DEFAULT_DURATIONS = [25, 40, 60];
const ACTIONS = {
  OPEN_ACTIVITY: '__OPEN_ACTIVITY__',
  START_OR_END: '__START_OR_END__',
  SHOW_RECORD: '__SHOW_RECORD__',
  CONFIRM_END: '__CONFIRM_END__',
  CONTINUE_ACTIVITY: '__CONTINUE_ACTIVITY__',
  MANUAL_ACTIVITY_HINT: '__MANUAL_ACTIVITY_HINT__',
  MANUAL_DURATION_HINT: '__MANUAL_DURATION_HINT__'
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'preview')));

const PREVIEW_OPENID = 'preview_user_001';

// 预览版提醒系统
let pendingReminders = new Set();

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.json({
      reply: '请输入内容',
      actions: [],
      state: await getPreviewState()
    });
  }

  try {
    const result = await processMessage(message.trim());
    res.json({
      ...result,
      state: await getPreviewState()
    });
  } catch (error) {
    console.error('预览处理错误:', error);
    res.json({
      reply: '抱歉，出错了：' + error.message,
      actions: [],
      state: await getPreviewState()
    });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const state = await getPreviewState();
    const reminders = [];

    if (state.activity) {
      const activity = state.activity;
      const now = new Date();
      const plannedEndTime = new Date(activity.startTime.getTime() + activity.plannedDuration * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // 检查是否需要发送时间到提醒
      if (now >= plannedEndTime && !pendingReminders.has(`timeup_${activity._id}`)) {
        reminders.push({
          type: 'timeup',
          message: `【${activity.name}】时间到！⏰\n\n点击菜单「结束」完成活动，收获完美番茄～ 🍅`
        });
        pendingReminders.add(`timeup_${activity._id}`);
      }

      // 检查是否需要发送超时提醒（30分钟后）
      if (activity.startTime.getTime() <= thirtyMinutesAgo.getTime() && !pendingReminders.has(`timeout_${activity._id}`)) {
        // 确保只在已经发送过时间到提醒之后才发送超时提醒
        if (pendingReminders.has(`timeup_${activity._id}`)) {
          reminders.push({
            type: 'timeout',
            message: `【${activity.name}】已经超时很久了哦～\n\n点击菜单「结束」完成活动，或直接开始下一个活动吧！`
          });
          pendingReminders.add(`timeout_${activity._id}`);
        }
      }
    }

    // 如果有提醒，带上提醒
    if (reminders.length > 0) {
      res.json({ ...state, reminders });
    } else {
      res.json(state);
    }
  } catch {
    res.json({
      ongoing: false,
      pendingStart: false,
      activity: null,
      sessionStep: 'idle',
      reminders: []
    });
  }
});

async function processMessage(content) {
  await userService.findOrCreateUser(PREVIEW_OPENID);
  const session = await sessionService.getSession(PREVIEW_OPENID);
  const ongoing = await activityService.getOngoingActivity(PREVIEW_OPENID);

  if (content === ACTIONS.OPEN_ACTIVITY) return await startActivityFlow();
  if (content === ACTIONS.SHOW_RECORD) return await showTodayRecord();
  if (content === ACTIONS.START_OR_END) {
    if (ongoing) {
      return await endActivityFlow();
    }

    if (session.step === 'ready_to_start') {
      return await startPendingActivity();
    }

    return await startActivityFlow(
      '先选一个活动，再选时长，然后点击下方「开始/结束」开始专注。'
    );
  }
  if (content === ACTIONS.MANUAL_ACTIVITY_HINT) {
    return replyWithActions('请直接在输入框输入活动名称，例如：写周报。', []);
  }
  if (content === ACTIONS.MANUAL_DURATION_HINT) {
    return replyWithActions('请直接在输入框输入时长数字，例如：30。', []);
  }
  if (content === ACTIONS.CONFIRM_END) return await completeActivity(true);
  if (content === ACTIONS.CONTINUE_ACTIVITY) return await continueActivity();

  if (content.startsWith('添加活动 ')) {
    const name = content.slice(5).trim();
    return await addActivityToPool(name);
  }
  if (content.startsWith('删除活动 ')) {
    const name = content.slice(5).trim();
    return await removeActivityFromPool(name);
  }
  if (content.startsWith('设置标签 ')) {
    const tag = content.slice(5).trim();
    await userService.addTag(PREVIEW_OPENID, tag);
    return `已添加标签【${tag}】`;
  }

  // 分步对话
  switch (session.step) {
    case 'selecting_activity':
      return await handleActivityNameInput(content);
    case 'setting_duration':
      return await handleDurationInput(content);
    case 'ready_to_start':
      return replyWithActions(
        '活动和时长已经选好了，点击下方「开始/结束」即可开始。',
        []
      );
    case 'confirming_early_end':
      return await handleEarlyEndConfirm(content);
    default:
      return replyWithActions(
        '点击下方「活动」选择项目，选完时长后再点击「开始/结束」开始专注。',
        buildHomeActions()
      );
  }
}

function replyWithActions(reply, actions = []) {
  return { reply, actions };
}

function createAction(label, value, style = 'default') {
  return { label, value, style };
}

function buildActivityOptions(activities) {
  const merged = [...activities];
  for (const item of DEFAULT_ACTIVITIES) {
    if (merged.length >= 3) break;
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }
  return merged.slice(0, 3);
}

function buildActivityActions(activities) {
  return [
    ...buildActivityOptions(activities).map((item) => createAction(item, item)),
    createAction('手动输入活动', ACTIONS.MANUAL_ACTIVITY_HINT, 'secondary')
  ];
}

function buildDurationActions() {
  return [
    ...DEFAULT_DURATIONS.map((item) => createAction(`${item}分钟`, String(item))),
    createAction('手动输入时长', ACTIONS.MANUAL_DURATION_HINT, 'secondary')
  ];
}

function buildHomeActions() {
  return [
    createAction('去选活动', ACTIONS.OPEN_ACTIVITY),
    createAction('查看记录', ACTIONS.SHOW_RECORD, 'secondary')
  ];
}

async function startActivityFlow(prefixText = '') {
  const ongoing = await activityService.getOngoingActivity(PREVIEW_OPENID);
  if (ongoing) {
    const elapsed = Math.round((Date.now() - ongoing.startTime) / (1000 * 60));
    return replyWithActions(
      `当前正在进行【${ongoing.name}】，已进行 ${elapsed} 分钟。\n\n如需结束，点击下方「开始/结束」。`,
      []
    );
  }

  const pool = await activityPoolService.getTodayPool(PREVIEW_OPENID);
  await sessionService.updateSession(PREVIEW_OPENID, { step: 'selecting_activity' });

  const lines = [];
  if (prefixText) lines.push(prefixText);
  lines.push('请选择一个活动。');
  lines.push('你也可以直接在输入框输入新的活动名称。');
  return replyWithActions(lines.join('\n\n'), buildActivityActions(pool.activities));
}

async function handleActivityNameInput(activityName) {
  if (!activityName) {
    return replyWithActions('请输入活动名称。', []);
  }

  await sessionService.updateSession(PREVIEW_OPENID, {
    step: 'setting_duration',
    tempActivityName: activityName,
    tempPlannedDuration: null
  });

  return replyWithActions(
    `你选择了【${activityName}】。\n\n请选择时长，或直接在输入框输入分钟数。`,
    buildDurationActions()
  );
}

async function handleDurationInput(durationStr) {
  const duration = parseInt(durationStr);
  if (isNaN(duration) || duration <= 0) {
    return replyWithActions('请输入有效的时长数字。', buildDurationActions());
  }

  const session = await sessionService.getSession(PREVIEW_OPENID);
  await sessionService.updateSession(PREVIEW_OPENID, {
    step: 'ready_to_start',
    tempActivityName: session.tempActivityName,
    tempPlannedDuration: duration
  });

  return replyWithActions(
    `已选择【${session.tempActivityName}】，时长${duration}分钟。\n\n请点击下方「开始/结束」开始。`,
    []
  );
}

async function startPendingActivity() {
  const session = await sessionService.getSession(PREVIEW_OPENID);
  if (!session.tempActivityName || !session.tempPlannedDuration) {
    await sessionService.resetSession(PREVIEW_OPENID);
    return await startActivityFlow('还没选完整活动信息，请重新选择。');
  }

  const activity = await activityService.startActivity(
    PREVIEW_OPENID,
    session.tempActivityName,
    session.tempPlannedDuration
  );

  await sessionService.resetSession(PREVIEW_OPENID);

  return replyWithActions(
    `已开始【${activity.name}】，时长${activity.plannedDuration}分钟。\n\n放下手机，专注当下～ 🎯`,
    []
  );
}

async function endActivityFlow() {
  const activity = await activityService.getOngoingActivity(PREVIEW_OPENID);
  if (!activity) {
    return replyWithActions(
      '当前没有进行中的活动。\n\n先点击下方「活动」选择项目吧。',
      buildHomeActions()
    );
  }

  const now = new Date();
  const plannedEndTime = new Date(activity.startTime.getTime() + activity.plannedDuration * 60 * 1000);

  if (now < plannedEndTime) {
    await sessionService.updateSession(PREVIEW_OPENID, { step: 'confirming_early_end' });
    return replyWithActions(
      `确定要提前结束【${activity.name}】吗？\n\n现在结束会得到一颗半熟番茄。`,
      [
        createAction('继续专注', ACTIONS.CONTINUE_ACTIVITY, 'secondary'),
        createAction('结束活动', ACTIONS.CONFIRM_END, 'danger')
      ]
    );
  }

  return await completeActivity(false);
}

async function handleEarlyEndConfirm(content) {
  if (content === ACTIONS.CONFIRM_END) return await completeActivity(true);
  if (content === ACTIONS.CONTINUE_ACTIVITY) return await continueActivity();
  return replyWithActions(
    '请点击按钮选择「继续专注」或「结束活动」。',
    [
      createAction('继续专注', ACTIONS.CONTINUE_ACTIVITY, 'secondary'),
      createAction('结束活动', ACTIONS.CONFIRM_END, 'danger')
    ]
  );
}

async function continueActivity() {
  await sessionService.resetSession(PREVIEW_OPENID);
  const activity = await activityService.getOngoingActivity(PREVIEW_OPENID);
  if (!activity) {
    return replyWithActions('当前没有进行中的活动。', buildHomeActions());
  }
  return replyWithActions(`好的，继续【${activity.name}】！💪`, []);
}

async function completeActivity(isEarlyEnd) {
  const activity = await activityService.endActivity(PREVIEW_OPENID, isEarlyEnd);
  await sessionService.resetSession(PREVIEW_OPENID);

  const emoji = activity.tomatoType === 'perfect' ? '🍅' : '🍳';
  const typeText = activity.tomatoType === 'perfect' ? '完美番茄' : '半熟番茄';

  return replyWithActions(
    `【${activity.name}】已完成！\n\n计划时长：${activity.plannedDuration}分钟\n实际用时：${activity.actualDuration}分钟\n\n获得 ${emoji} ${typeText}`,
    buildHomeActions()
  );
}

async function addActivityToPool(activityName) {
  if (!activityName) return replyWithActions('请输入活动名称，格式：添加活动 xxx', []);
  await activityPoolService.addActivity(PREVIEW_OPENID, activityName);
  const pool = await activityPoolService.getTodayPool(PREVIEW_OPENID);
  return replyWithActions(
    `已添加【${activityName}】到今日活动池！\n\n已为你准备可点击活动按钮。`,
    buildActivityActions(pool.activities)
  );
}

async function removeActivityFromPool(activityName) {
  await activityPoolService.removeActivity(PREVIEW_OPENID, activityName);
  const pool = await activityPoolService.getTodayPool(PREVIEW_OPENID);
  return replyWithActions(
    `已从今日活动池移除【${activityName}】`,
    buildActivityActions(pool.activities)
  );
}

async function showTodayRecord() {
  const activities = await activityService.getTodayActivities(PREVIEW_OPENID);
  if (activities.length === 0) {
    return replyWithActions(
      '今天还没有活动记录。\n\n先点击下方「活动」选一个项目吧。',
      buildHomeActions()
    );
  }

  let reply = '📅 今日时间线\n\n';
  let perfectCount = 0, halfRipeCount = 0, totalMinutes = 0;

  activities.slice().reverse().forEach(activity => {
    const startTime = activity.startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const emoji = activity.tomatoType === 'perfect' ? '🍅' : (activity.tomatoType === 'half-ripe' ? '🍳' : '');
    if (activity.tomatoType === 'perfect') perfectCount++;
    if (activity.tomatoType === 'half-ripe') halfRipeCount++;
    if (activity.actualDuration) totalMinutes += activity.actualDuration;

    reply += `${startTime} 【${activity.name}】`;
    if (activity.actualDuration) reply += ` ${activity.actualDuration}分钟 ${emoji}`;
    else if (activity.status === 'ongoing') reply += ' 进行中...';
    reply += '\n';
  });

  reply += `\n📊 今日统计\n总专注时长：${formatDuration(totalMinutes)}\n完美番茄：${perfectCount} 个\n半熟番茄：${halfRipeCount} 个`;
  return replyWithActions(reply, buildHomeActions());
}

async function getPreviewState() {
  const session = await sessionService.getSession(PREVIEW_OPENID);
  const ongoing = await activityService.getOngoingActivity(PREVIEW_OPENID);

  return {
    ongoing: !!ongoing,
    pendingStart: session.step === 'ready_to_start',
    sessionStep: session.step,
    activityButtonLabel: '活动',
    actionButtonLabel: '开始/结束',
    selectedActivity: session.tempActivityName || null,
    selectedDuration: session.tempPlannedDuration || null,
    activity: ongoing ? {
      _id: ongoing._id.toString(),
      name: ongoing.name,
      plannedDuration: ongoing.plannedDuration,
      startTime: ongoing.startTime.toISOString(),
      elapsed: Math.round((Date.now() - ongoing.startTime) / (1000 * 60))
    } : null
  };
}

connectPreviewDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`  主动番茄 - 本地预览模式`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`===========================================\n`);
  });
});
