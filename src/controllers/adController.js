'use strict';

const adService      = require('../services/adService');
const adsOrchestrator = require('../orchestrators/adsOrchestrator');

async function list(req, res, next) {
  try {
    const ads = await adService.getAdsByCampaign(req.params.campaignId, req.user.teamId);
    return res.status(200).json({ success: true, data: { ads } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const ad = await adService.createAd(req.params.campaignId, req.body);
    return res.status(201).json({ success: true, data: { ad } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const ad = await adService.updateAd(req.params.id, req.body);
    return res.status(200).json({ success: true, data: { ad } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await adService.deleteAd(req.params.id);
    return res.status(200).json({ success: true, data: { message: 'Ad deleted' } });
  } catch (err) {
    next(err);
  }
}

async function generate(req, res, next) {
  try {
    const result = await adsOrchestrator.generate(
      req.params.campaignId,
      req.body,
      req.user.teamId
    );
    return res.status(200).json({
      success: true,
      data:    result,
      meta:    { cached: result._cached },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, generate };
