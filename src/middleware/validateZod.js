'use strict';

const { ZodError } = require('zod');
const { failure }  = require('../common/response');

/**
 * Factory: returns Express middleware that validates req[target]
 * against a Zod schema.
 *
 * - Strips unknown fields (via .strip() — schemas must be z.object())
 * - Returns 422 with structured errors on failure
 * - Replaces req[target] with the parsed (stripped + coerced) value on success
 *
 * Usage: router.post('/', validateZod(mySchema), controller)
 */
function validateZod(schema, target = 'body') {
  return function (req, res, next) {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const issues = result.error.issues ?? result.error.errors ?? [];
      const message = issues
        .map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
        .join('; ');
      return failure(res, message, 422, 'VALIDATION_ERROR');
    }

    req[target] = result.data;
    next();
  };
}

module.exports = validateZod;
