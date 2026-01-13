const wooCommerceClient = require('./woocommerceClient');

class UsernameService {
  /**
   * Generates 5 unique username suggestions
   */
  async generateSuggestions(firstName, lastName, email) {
    const baseSuggestions = [];
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    // Strategy 1: Firstname + Lastname
    baseSuggestions.push(`${cleanFirst}${cleanLast}`);
    
    // Strategy 2: Email prefix
    baseSuggestions.push(emailPrefix);
    
    // Strategy 3: Firstname + random number
    baseSuggestions.push(`${cleanFirst}${Math.floor(Math.random() * 1000)}`);
    
    // Strategy 4: First char of first + lastname
    baseSuggestions.push(`${cleanFirst.charAt(0)}${cleanLast}`);
    
    // Strategy 5: Lastname + Firstname
    baseSuggestions.push(`${cleanLast}${cleanFirst}`);

    // Deduplicate base suggestions
    const uniqueBase = [...new Set(baseSuggestions)];

    // Ensure length constraints (6-20 chars for example)
    // and Uniqueness check against WooCommerce
    const finalSuggestions = [];
    
    for (let username of uniqueBase) {
      // Basic formatting
      if (username.length < 6) {
        username = username + Math.floor(Math.random() * 1000);
      }
      
      const isAvailable = await this.isUsernameAvailable(username);
      if (isAvailable) {
        finalSuggestions.push(username);
      } else {
        // If taken, append random number
        const alt = `${username}${Math.floor(Math.random() * 999)}`;
        if (await this.isUsernameAvailable(alt)) {
          finalSuggestions.push(alt);
        }
      }
      
      if (finalSuggestions.length >= 5) break;
    }

    return finalSuggestions;
  }

  async isUsernameAvailable(username) {
    try {
      const customers = await wooCommerceClient.get('/customers', { 
        search: username, // Note: WC API search is broad, usually checks email/name too
        role: 'all' 
      });
      
      // Strict check: Since WC search is fuzzy, we must check exact match
      const exists = customers.some(c => c.username === username);
      return !exists;
    } catch (error) {
      console.error('Error checking username:', error);
      return false; // Fail safe
    }
  }
}

module.exports = new UsernameService();
