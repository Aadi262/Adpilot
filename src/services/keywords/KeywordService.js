'use strict';

const prisma    = require('../../config/prisma');
const AppError  = require('../../common/AppError');
const { normalizeKeywordText, getKeywordQualityIssue } = require('../../utils/keywordQuality');

/**
 * KeywordService — create and delete tracked keywords.
 *
 * All methods are team-scoped.  The caller (controller) is responsible for
 * passing validated inputs.
 */
class KeywordService {
  /**
   * Add a keyword to the team's tracking list.
   *
   * @param {string} teamId
   * @param {string} userId        — the user who initiated the action
   * @param {object} data
   * @param {string} data.keyword
   * @param {string} [data.trackedUrl]
   * @param {number} [data.searchVolume=0]
   * @param {number} [data.difficulty=0]
   * @param {string} [data.source='manual']  — 'manual' | 'audit' | 'ai'
   * @returns {Promise<Keyword>}
   */
  async createKeyword(teamId, userId, { keyword, trackedUrl, searchVolume, difficulty, source }) {
    const qualityIssue = getKeywordQualityIssue(keyword);
    if (qualityIssue) throw AppError.badRequest(qualityIssue);

    return prisma.keyword.create({
      data: {
        teamId,
        keyword:      normalizeKeywordText(keyword),
        searchVolume: searchVolume ?? 0,
        difficulty:   difficulty   ?? 0,
        trackedUrl:   trackedUrl   ?? null,
        source:       source       ?? 'manual',
        createdBy:    userId,
        isActive:     true,
      },
    });
  }

  /**
   * Remove a tracked keyword.
   * Verifies team ownership before deleting; 404 if not found.
   *
   * @param {string} id
   * @param {string} teamId
   */
  async deleteKeyword(id, teamId) {
    const kw = await prisma.keyword.findFirst({ where: { id, teamId }, select: { id: true } });
    if (!kw) throw AppError.notFound('Keyword');
    await prisma.keyword.delete({ where: { id } });
  }
}

module.exports = new KeywordService();
