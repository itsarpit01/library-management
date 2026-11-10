import { MAX_REISSUES } from "./dates.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const FINE_PER_DAY = Number(process.env.FINE_PER_DAY) || 5;

export const calcFine = (dueDate, endDate = new Date()) => {
  const lateDays = Math.ceil((endDate - dueDate) / DAY_MS);
  return lateDays > 0 ? lateDays * FINE_PER_DAY : 0;
};

// isOverdue, currentFine aur canReissue jodta hai
export const withOverdueInfo = (issue) => {
  const obj = typeof issue.toObject === "function" ? issue.toObject() : { ...issue };
  if (obj.status === "issued") {
    obj.isOverdue = new Date() > obj.dueDate;
    obj.currentFine = obj.finePaid ? 0 : calcFine(obj.dueDate);
    obj.rawFine = calcFine(obj.dueDate);
    obj.canReissue = !obj.isOverdue && (obj.reissueCount || 0) < MAX_REISSUES;
  } else {
    obj.isOverdue = false;
    obj.currentFine = obj.finePaid ? 0 : (obj.fine || 0);
    obj.rawFine = obj.fine || 0;
    obj.canReissue = false;
  }
  return obj;
};