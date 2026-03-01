'use strict';

const campaignService = require('../services/campaignService');
const { createNotification } = require('../services/notificationHelper');

async function list(req, res, next) {
  try {
    const { status, platform } = req.query;
    const campaigns = await campaignService.getAllCampaigns(req.user.teamId, { status, platform });
    return res.status(200).json({ success: true, data: { campaigns } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const campaign = await campaignService.getCampaignById(req.params.id, req.user.teamId);
    return res.status(200).json({ success: true, data: { campaign } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const campaign = await campaignService.createCampaign(req.user.teamId, req.body);
    return res.status(201).json({ success: true, data: { campaign } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.user.teamId, req.body);
    return res.status(200).json({ success: true, data: { campaign } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await campaignService.deleteCampaign(req.params.id, req.user.teamId);
    return res.status(200).json({ success: true, data: { message: 'Campaign deleted' } });
  } catch (err) {
    next(err);
  }
}

async function launch(req, res, next) {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.user.teamId, { status: 'active' });
    createNotification(req.user.teamId, {
      userId: req.user.userId,
      message: `Campaign "${campaign.name}" is now live`,
      type: 'success',
      campaignId: campaign.id,
    });
    return res.status(200).json({ success: true, data: { campaign } });
  } catch (err) {
    next(err);
  }
}

async function pause(req, res, next) {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.user.teamId, { status: 'paused' });
    createNotification(req.user.teamId, {
      userId: req.user.userId,
      message: `Campaign "${campaign.name}" has been paused`,
      type: 'warning',
      campaignId: campaign.id,
    });
    return res.status(200).json({ success: true, data: { campaign } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, launch, pause };
