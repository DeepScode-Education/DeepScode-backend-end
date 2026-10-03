// utils/batchSchedule.js

const BATCH_DAY_WEEKDAYS = {
  MTW: [1, 2, 3],
  MWT: [1, 3, 4],
  MTT: [1, 2, 4],
  SS: [0, 6],
};

const BATCH_TIME_SLOTS = {
  "10:00-12:00": { startHour: 10, startMinute: 0, endHour: 12, endMinute: 0, label: "10:00 AM - 12:00 PM" },
  "12:00-2:00": { startHour: 12, startMinute: 0, endHour: 14, endMinute: 0, label: "12:00 PM - 2:00 PM" },
  "2:30-4:30": { startHour: 14, startMinute: 30, endHour: 16, endMinute: 30, label: "2:30 PM - 4:30 PM" },
  "4:30-6:30": { startHour: 16, startMinute: 30, endHour: 18, endMinute: 30, label: "4:30 PM - 6:30 PM" },
};

const BATCH_DAY_LABELS = {
  MTW: "Mon, Tue, Wed",
  MWT: "Mon, Wed, Thu",
  MTT: "Mon, Tue, Thu",
  SS: "Sat, Sun",
};

const nextDateForWeekday = (fromDate, weekday) => {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  let diff = weekday - currentDay;
  if (diff < 0) diff += 7;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const previousDateForWeekday = (fromDate, weekday) => {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  let diff = currentDay - weekday;
  if (diff < 0) diff += 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Resolves whether the student's class is live, upcoming, or completed,
 * based on the assigned batch day pattern + time slot.
 */
const resolveLiveClassInfo = (batchDayPattern, batchTimeSlot, mentorName, meetingLink, now = new Date()) => {
  const weekdays = BATCH_DAY_WEEKDAYS[batchDayPattern] || [];
  const slot = BATCH_TIME_SLOTS[batchTimeSlot];

  const base = {
    status: "upcoming",
    batchDayPattern,
    batchTimeSlot,
    timeLabel: slot ? slot.label : batchTimeSlot,
    dayLabel: BATCH_DAY_LABELS[batchDayPattern] || batchDayPattern,
    mentorName,
    nextClassDate: null,
    lastCompletedDate: null,
    meetingLink,
  };

  if (!slot || weekdays.length === 0) return base;

  const todayWeekday = now.getDay();
  const isScheduledToday = weekdays.indexOf(todayWeekday) !== -1;

  if (isScheduledToday) {
    const startMinutes = slot.startHour * 60 + slot.startMinute;
    const endMinutes = slot.endHour * 60 + slot.endMinute;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
      base.status = "live";
      base.nextClassDate = new Date(now);
      return base;
    }

    if (nowMinutes < startMinutes) {
      base.status = "upcoming";
      const todayAtStart = new Date(now);
      todayAtStart.setHours(slot.startHour, slot.startMinute, 0, 0);
      base.nextClassDate = todayAtStart;
      return base;
    }
  }

  let nearestUpcoming = null;
  let mostRecentCompleted = null;

  for (let i = 0; i < weekdays.length; i++) {
    const weekday = weekdays[i];
    const upcoming = nextDateForWeekday(now, weekday);
    if (nearestUpcoming === null || upcoming.getTime() < nearestUpcoming.getTime()) {
      nearestUpcoming = upcoming;
    }
    const previous = previousDateForWeekday(now, weekday);
    if (mostRecentCompleted === null || previous.getTime() > mostRecentCompleted.getTime()) {
      mostRecentCompleted = previous;
    }
  }

  if (nearestUpcoming) {
    nearestUpcoming.setHours(slot.startHour, slot.startMinute, 0, 0);
  }

  base.status = "upcoming";
  base.nextClassDate = nearestUpcoming;
  base.lastCompletedDate = mostRecentCompleted;

  return base;
};

module.exports = { resolveLiveClassInfo, BATCH_DAY_WEEKDAYS, BATCH_TIME_SLOTS, BATCH_DAY_LABELS };