'use strict';

const AppError = require('../../common/AppError');
const competitorHijackService = require('../ai/CompetitorHijackService');
const { researchReportRepository } = require('../../repositories/ResearchReportRepository');

class ResearchOrchestratorService {
  async listCompetitors(teamId) {
    return researchReportRepository.listCompetitors(teamId);
  }

  async createCompetitor(teamId, { domain, name }) {
    if (!domain) throw AppError.badRequest('domain is required');

    const cleanDomain = this._normalizeDomain(domain);
    const existing = await researchReportRepository.findCompetitorByDomain(teamId, cleanDomain);
    if (existing) throw AppError.conflict('Competitor already tracked');

    return researchReportRepository.createCompetitor(teamId, {
      domain: cleanDomain,
      name,
    });
  }

  async deleteCompetitor(teamId, id) {
    const existing = await researchReportRepository.findCompetitor(teamId, id);
    if (!existing) throw AppError.notFound('Competitor not found');
    await researchReportRepository.deleteCompetitor(id);
  }

  async runAttackAnalysis(teamId, domain) {
    if (!domain) throw AppError.badRequest('domain query param is required');
    const cleanDomain = this._normalizeDomain(domain);
    const analysis = await competitorHijackService.analyzeCompetitor(cleanDomain, teamId, 'attack');
    await researchReportRepository.saveCompetitorKeywords(teamId, analysis);
    const report = await researchReportRepository.saveReport({
      teamId,
      kind: 'adIntel',
      query: cleanDomain,
      analysis,
    });
    return { analysis, report };
  }

  async runOverviewAnalysis(teamId, url) {
    if (!url) throw AppError.badRequest('url is required');
    const cleanDomain = this._normalizeDomain(url);
    const analysis = await competitorHijackService.analyzeCompetitor(cleanDomain, teamId, 'overview');
    await researchReportRepository.saveCompetitorKeywords(teamId, analysis);
    const report = await researchReportRepository.saveReport({
      teamId,
      kind: 'market',
      query: url,
      analysis,
    });
    return { analysis, report };
  }

  async getLatestReport(teamId, kind) {
    return researchReportRepository.getLatestReport(teamId, kind);
  }

  async getReports(teamId, kind, limit) {
    return researchReportRepository.getReports(teamId, kind, limit);
  }

  _normalizeDomain(value) {
    return String(value || '')
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .trim();
  }
}

module.exports = new ResearchOrchestratorService();
