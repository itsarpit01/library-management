import mongoose from "mongoose";
import PurchaseRequest from "../models/PurchaseRequest.js";

const checkId = (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid request id" });
    return false;
  }
  return true;
};


export const createRequest = async (req, res) => {
  const request = await PurchaseRequest.create({
    ...req.body,
    requestedBy: req.user.id,
  });
  res.status(201).json(request);
};


export const getMyRequests = async (req, res) => {
  const filter = { requestedBy: req.user.id };
  if (req.query.status) filter.status = req.query.status;

  const requests = await PurchaseRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("reviewedBy", "name");
  res.json(requests);
};


export const cancelRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;

  const deleted = await PurchaseRequest.findOneAndDelete({
    _id: req.params.id,
    requestedBy: req.user.id,
    status: "pending",
  });

  if (!deleted) {
    return res.status(404).json({ message: "Pending request not found" });
  }
  res.json({ message: "Request cancelled" });
};

export const getAllRequests = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const requests = await PurchaseRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("requestedBy", "name email")
    .populate("reviewedBy", "name");
  res.json(requests);
};

export const reviewRequest = async (req, res) => {
  if (!checkId(req.params.id, res)) return;
  const { status, reviewNote } = req.body;

  const updated = await PurchaseRequest.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    { status, reviewNote, reviewedBy: req.user.id, reviewedAt: new Date() },
    { new: true }
  );

  if (!updated) {
    const exists = await PurchaseRequest.exists({ _id: req.params.id });
    return exists
      ? res.status(409).json({ message: "Request already reviewed" })
      : res.status(404).json({ message: "Request not found" });
  }
  res.json(updated);
};