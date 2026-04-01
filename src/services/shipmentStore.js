const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SHIPMENTS_FILE = path.join(__dirname, '..', '..', 'data', 'shipments.json');

/**
 * Persistent shipment tracking store using JSON file.
 * Maps WooCommerce order IDs to Shiprocket shipment data.
 * Stores detailed shipping status that WooCommerce doesn't track.
 */
class ShipmentStore {
  constructor() {
    this.shipments = new Map();
    this._ensureDataDir();
    this._load();
  }

  _ensureDataDir() {
    const dir = path.dirname(SHIPMENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _load() {
    try {
      if (fs.existsSync(SHIPMENTS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SHIPMENTS_FILE, 'utf8'));
        for (const [key, info] of Object.entries(data)) {
          this.shipments.set(key, info);
        }
        logger.info(`Loaded ${this.shipments.size} shipment records from disk`);
      }
    } catch (err) {
      logger.error('Failed to load shipments:', err.message);
    }
  }

  _save() {
    try {
      const obj = Object.fromEntries(this.shipments);
      fs.writeFileSync(SHIPMENTS_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
      logger.error('Failed to save shipments:', err.message);
    }
  }

  /**
   * Update shipment tracking for an order
   * @param {string|number} orderId - WooCommerce order ID
   * @param {object} data - Shiprocket webhook payload
   */
  update(orderId, data) {
    const key = String(orderId);
    const existing = this.shipments.get(key) || { history: [] };

    const entry = {
      sr_status: data.current_status,
      sr_status_code: data.current_status_id,
      shipment_id: data.shipment_id,
      awb: data.awb_code,
      courier: data.courier_name,
      etd: data.etd || null,
      tracking_url: data.tracking_url || null,
      scans: data.scans || [],
      updated_at: new Date().toISOString(),
    };

    // Add to history if status actually changed
    const lastStatus = existing.history.length > 0
      ? existing.history[existing.history.length - 1].sr_status
      : null;

    if (lastStatus !== data.current_status) {
      existing.history.push({
        status: data.current_status,
        status_code: data.current_status_id,
        timestamp: new Date().toISOString(),
      });
    }

    this.shipments.set(key, {
      ...entry,
      history: existing.history,
    });

    this._save();
    return this.shipments.get(key);
  }

  /**
   * Get shipment tracking for an order
   */
  getByOrderId(orderId) {
    return this.shipments.get(String(orderId)) || null;
  }

  /**
   * Get all tracked shipments
   */
  getAll() {
    return Object.fromEntries(this.shipments);
  }
}

module.exports = new ShipmentStore();
