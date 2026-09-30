/**
 * Tour API service — reads virtual tour data from the backend.
 * All endpoints are public (no authentication required).
 */

import axios from 'axios';
import API_BASE_URL from '../config/api';

const tourClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

/**
 * Fetch the starting TourNode for a museum's virtual tour.
 * @param {number} museumId
 * @returns {Promise<Object>} node data with edges and objects
 */
export const fetchTourStart = async (museumId) => {
  const res = await tourClient.get(`/tour/museums/${museumId}/start`);
  return res.data.data;
};

/**
 * Fetch full data for a single TourNode.
 * @param {number} nodeId
 * @returns {Promise<Object>} { id, name, panorama_url, tile_base_url, tile_config, tile_status, edges[], objects[] }
 */
export const fetchTourNode = async (nodeId) => {
  const res = await tourClient.get(`/tour/node/${nodeId}`);
  return res.data.data;
};

/**
 * Fetch full artifact detail for the in-tour object card.
 * @param {number} objectId
 * @returns {Promise<Object>} { id, name, category?, period_era?, materials?, ... angle_photos? }
 */
export const fetchTourObject = async (objectId) => {
  const res = await tourClient.get(`/tour/object/${objectId}`);
  return res.data.data;
};
