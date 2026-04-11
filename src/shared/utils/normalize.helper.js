'use strict';

function normalizeString(value = '') {
  return String(value ?? '').trim();
}

function normalizeUpperString(value = '') {
  return normalizeString(value).toUpperCase();
}

function normalizeLowerString(value = '') {
  return normalizeString(value).toLowerCase();
}

function removeDiacritics(value = '') {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeLookupKey(value = '') {
  return removeDiacritics(value).toLowerCase();
}

function normalizeDocumento(value = '') {
  return normalizeString(value).replace(/\.0+$/, '');
}

function normalizeHorario(value = '') {
  return normalizeUpperString(value);
}

function normalizeAula(value = '') {
  return normalizeUpperString(value);
}

function normalizeKey(value = '') {
  return normalizeLookupKey(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

module.exports = {
  normalizeString,
  normalizeUpperString,
  normalizeLowerString,
  removeDiacritics,
  normalizeLookupKey,
  normalizeDocumento,
  normalizeHorario,
  normalizeAula,
  normalizeKey,
};
