import { MAX_REISSUES } from "./dates.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const FINE_PER_DAY = Number(process.env.FINE_PER_DAY) || 5;

export const calcFine = (dueDate, endDate = new Date()) => {
  const lateDays = Math.ceil((endDate - dueDate) / DAY_MS);
  return lateDays > 0 ? lateDays * FINE_PER_DAY : 0;
};

// isOverdue, currentFine aur canReissue jodta hai
export const withOverdueInfo = (issue) => {
  const obj = issue.toObject();
  if (obj.status === "issued") {
    obj.isOverdue = new Date() > obj.dueDate;
    obj.currentFine = calcFine(obj.dueDate);
    obj.canReissue = !obj.isOverdue && (obj.reissueCount || 0) < MAX_REISSUES;
  } else {
    obj.isOverdue = false;
    obj.currentFine = obj.fine;
    obj.canReissue = false;
  }
  return obj;
};