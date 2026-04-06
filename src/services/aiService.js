const { GoogleGenAI } = require('@google/genai');
const catalogSearch = require('./catalogSearch');
const logger = require('../utils/logger');

const FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-2.0-flash-lite';
const EXPERT_MODEL = process.env.GEMINI_EXPERT_MODEL || 'gemini-2.5-flash';
const MAX_TOKENS = parseInt(process.env.CHAT_MAX_TOKENS) || 300;

/**
 * System instruction — Gemini caches this across turns automatically
 * when using the same chat session, saving input tokens.
 */
const SYSTEM_INSTRUCTION = `You are MakeupOcean's friendly beauty assistant. Your name is Mia.

BRAND VOICE:
- Warm, knowledgeable, concise
- Use simple language, avoid jargon
- Always be encouraging about beauty choices
- Never recommend competitor products or stores

RULES:
- Keep responses under 3 short paragraphs
- When showing products, mention name, price, and if it's on sale
- If asked about order status, ask for the order number
- If the user seems frustrated or asks a question you can't handle, use the escalate_to_human function
- If the user asks complex styling advice (color matching, skin type analysis, full routine), use the escalate_to_expert function to get a more detailed answer
- For product searches, use the search_products function — NEVER guess product names or prices
- Currency is AED (UAE Dirhams)
- 30-day return policy on unopened items
- Free shipping on orders over 200 AED
- Standard delivery: 2-5 business days within UAE

CAPABILITIES:
- Search the product catalog
- Check order status
- Help with product recommendations
- Answer questions about shipping, returns, and policies
- Escalate to human support when needed`;

/**
 * Gemini function declarations (tool definitions)
 */
const TOOL_DECLARATIONS = [
  {
    name: 'search_products',
    description: 'Search the MakeupOcean catalog for products by keyword. Returns top 2-3 results with name, price, stock status, and image. Use this whenever the user asks about a product, wants recommendations, or mentions a specific item.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (e.g. "matte lipstick", "foundation for oily skin", "red nail polish")'
        },
        limit: {
          type: 'number',
          description: 'Max number of results (1-3, default 3)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_by_category',
    description: 'Browse products in a specific category. Use when user asks "show me lipsticks" or "what foundations do you have".',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category name (e.g. "Lipstick", "Foundation", "Eye Shadow")'
        },
        limit: {
          type: 'number',
          description: 'Max results (1-3, default 3)'
        }
      },
      required: ['category']
    }
  },
  {
    name: 'check_order_status',
    description: 'Look up the current status of a customer order by order ID.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'number',
          description: 'The WooCommerce order ID'
        }
      },
      required: ['order_id']
    }
  },
  {
    name: 'get_product_details',
    description: 'Get full details for a single product by its ID. Use after a search to give more info.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'The WooCommerce product ID'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'escalate_to_expert',
    description: 'Escalate a complex beauty question (color matching, full routine advice, skin type analysis) to a more capable AI model for a detailed answer.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The complex question to escalate'
        },
        context: {
          type: 'string',
          description: 'Relevant context from the conversation so far'
        }
      },
      required: ['question']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Transfer the chat to a human support agent. Use when the user explicitly asks for a human, is frustrated, or has a problem you cannot resolve (payment issues, complaints, account problems).',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the user needs human support'
        }
      },
      required: ['reason']
    }
  }
];

class AIService {
  constructor() {
    this.client = null;
    this._initClient();
  }

  _initClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      logger.warn('GEMINI_API_KEY not set — AI service will use mock mode');
      this.mockMode = true;
      return;
    }
    this.client = new GoogleGenAI({ apiKey });
    this.mockMode = false;
    logger.info('Gemini AI service initialized');
  }

  /**
   * Process a user message through the AI pipeline.
   * @param {string} message - User's message
   * @param {Array} history - Conversation history [{role, content}]
   * @param {object} userContext - {userId, userName, customerId}
   * @param {function} onStream - Callback for streaming text chunks
   * @returns {object} {text, products, escalateHuman, toolsUsed}
   */
  async processMessage(message, history = [], userContext = {}, onStream = null) {
    if (this.mockMode) {
      return this._mockResponse(message, userContext);
    }

    const contents = this._buildContents(history, message);

    try {
      return await this._callGemini(FAST_MODEL, contents, userContext, onStream);
    } catch (error) {
      logger.error('AI processMessage error:', error.message);

      // Auto-escalate to human support on API limit/quota errors
      const status = error.status || error.httpStatusCode || error.code;
      const isLimitError = status === 429 || status === 'RESOURCE_EXHAUSTED' ||
        /rate.limit|quota|too.many.requests/i.test(error.message);

      if (isLimitError) {
        logger.warn('AI API limit reached — auto-escalating to human support');
        return {
          text: "Our AI assistant is temporarily unavailable due to high demand. Let me connect you with our support team right away!",
          products: [],
          escalateHuman: true,
          toolsUsed: []
        };
      }

      return {
        text: "I'm having trouble right now. Would you like me to connect you with our support team?",
        products: [],
        escalateHuman: false,
        toolsUsed: []
      };
    }
  }

  /**
   * Core Gemini API call with automatic function-calling loop
   */
  async _callGemini(model, contents, userContext, onStream, depth = 0) {
    if (depth > 5) {
      return { text: 'Let me connect you with our team for better help.', products: [], escalateHuman: true, toolsUsed: [] };
    }

    const result = { text: '', products: [], escalateHuman: false, toolsUsed: [] };

    const config = {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.7,
    };

    // Use streaming for the first call if callback provided
    if (onStream && depth === 0) {
      return this._callGeminiStreaming(model, contents, config, userContext, onStream);
    }

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: {
        ...config,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    });

    // Process response parts
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.text) {
        result.text += part.text;
      } else if (part.functionCall) {
        const fc = part.functionCall;
        const args = fc.args || {};
        result.toolsUsed.push(fc.name);

        // Handle escalation short-circuits
        if (fc.name === 'escalate_to_human') {
          result.escalateHuman = true;
          result.text = result.text || `I'll connect you with our support team. Reason: ${args.reason}`;
          return result;
        }

        if (fc.name === 'escalate_to_expert') {
          const expertText = await this._callExpert(args.question, args.context || '');
          result.text = expertText;
          return result;
        }

        // Execute tool
        const toolResult = await this._executeTool(fc.name, args, userContext, result);

        // Append assistant's function call + function response, then recurse
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name: fc.name, args } }]
        });
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: fc.name, response: toolResult } }]
        });

        return this._callGemini(model, contents, userContext, null, depth + 1);
      }
    }

    return result;
  }

  /**
   * Streaming Gemini call — sends text chunks via onStream callback
   */
  async _callGeminiStreaming(model, contents, config, userContext, onStream) {
    const result = { text: '', products: [], escalateHuman: false, toolsUsed: [] };

    const response = await this.client.models.generateContentStream({
      model,
      contents,
      config: {
        ...config,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    });

    let pendingFunctionCall = null;

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.text) {
          result.text += part.text;
          onStream(part.text);
        } else if (part.functionCall) {
          pendingFunctionCall = part.functionCall;
        }
      }
    }

    // Handle function call collected during streaming
    if (pendingFunctionCall) {
      const fc = pendingFunctionCall;
      const args = fc.args || {};
      result.toolsUsed.push(fc.name);

      if (fc.name === 'escalate_to_human') {
        result.escalateHuman = true;
        if (!result.text) {
          const msg = "I'll connect you with our support team right away.";
          result.text = msg;
          onStream(msg);
        }
        return result;
      }

      if (fc.name === 'escalate_to_expert') {
        onStream('\n\n_Getting expert advice..._\n\n');
        const expertText = await this._callExpert(args.question, args.context || '');
        result.text = expertText;
        onStream(expertText);
        return result;
      }

      // Execute tool
      const toolResult = await this._executeTool(fc.name, args, userContext, result);

      // Build follow-up contents with function result
      contents.push({
        role: 'model',
        parts: [{ functionCall: { name: fc.name, args } }]
      });
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: fc.name, response: toolResult } }]
      });

      // Non-streaming follow-up to compose final response with tool data
      const followUp = await this._callGemini(FAST_MODEL, contents, userContext, null, 1);
      if (followUp.text) onStream(followUp.text);
      result.text += followUp.text;
      result.products.push(...followUp.products);
      return result;
    }

    return result;
  }

  /**
   * Execute a function call and return its result
   */
  async _executeTool(name, args, userContext, result) {
    switch (name) {
      case 'search_products': {
        const products = await catalogSearch.search(args.query, args.limit || 3);
        result.products.push(...products);
        return products.length > 0
          ? { found: true, count: products.length, products }
          : { found: false, message: 'No products found matching your search.' };
      }
      case 'search_by_category': {
        const products = await catalogSearch.searchByCategory(args.category, args.limit || 3);
        result.products.push(...products);
        return products.length > 0
          ? { found: true, count: products.length, products }
          : { found: false, message: 'No products found in this category.' };
      }
      case 'check_order_status': {
        const order = await catalogSearch.getOrderStatus(args.order_id, userContext.customerId);
        return order;
      }
      case 'get_product_details': {
        const product = await catalogSearch.getProduct(args.product_id);
        if (product) result.products.push(product);
        return product || { error: 'Product not found' };
      }
      case 'escalate_to_expert': {
        return { escalated: true };
      }
      case 'escalate_to_human': {
        return { escalated: true, reason: args.reason };
      }
      default:
        return { error: `Unknown function: ${name}` };
    }
  }

  /**
   * Tiered routing: call the expert model (Gemini 2.5 Flash) for complex questions.
   */
  async _callExpert(question, context) {
    try {
      const response = await this.client.models.generateContent({
        model: EXPERT_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{
              text: context
                ? `Context from our conversation: ${context}\n\nQuestion: ${question}`
                : question
            }]
          }
        ],
        config: {
          maxOutputTokens: 500,
          temperature: 0.7,
          systemInstruction: `You are Mia, MakeupOcean's expert beauty advisor. Give detailed, personalized beauty advice. Keep it warm and practical. Currency is AED. MakeupOcean ships within UAE, 2-5 business days. Keep your response under 4 paragraphs.`,
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Let me help you with that!';
    } catch (error) {
      logger.error('Expert model call failed:', error.message);
      return "I'd love to give you detailed advice on this! Let me connect you with our beauty expert team.";
    }
  }

  /**
   * Mock responses when no API key is configured (Phase 4)
   */
  async _mockResponse(message, userContext) {
    const lower = message.toLowerCase();
    const result = { text: '', products: [], escalateHuman: false, toolsUsed: [] };

    if (lower.includes('lipstick') || lower.includes('foundation') || lower.includes('mascara') ||
        lower.includes('blush') || lower.includes('eyeshadow') || lower.includes('concealer') ||
        lower.includes('product') || lower.includes('recommend') || lower.includes('looking for')) {
      const searchTerms = ['lipstick', 'foundation', 'mascara', 'blush', 'eyeshadow', 'concealer', 'primer', 'serum', 'moisturizer', 'nail polish'];
      const found = searchTerms.find(t => lower.includes(t)) || message.split(' ').slice(-2).join(' ');

      const products = await catalogSearch.search(found, 3);
      result.products = products;
      result.toolsUsed.push('search_products');

      if (products.length > 0) {
        const productLines = products.map(p =>
          `**${p.name}** — ${p.on_sale ? `~~${p.regular_price} AED~~ ${p.price} AED` : `${p.price} AED`} ${p.in_stock ? '(In Stock)' : '(Out of Stock)'}`
        ).join('\n');
        result.text = `Great choice! Here's what I found:\n\n${productLines}\n\nWould you like more details on any of these?`;
      } else {
        result.text = `I couldn't find any ${found} in our catalog right now. Would you like me to search for something else?`;
      }
    } else if (lower.includes('order') && /\d+/.test(lower)) {
      const orderId = lower.match(/\d+/)?.[0];
      if (orderId) {
        const order = await catalogSearch.getOrderStatus(parseInt(orderId), userContext.customerId);
        result.toolsUsed.push('check_order_status');
        if (order.error) {
          result.text = `I couldn't find order #${orderId}. Could you double-check the order number?`;
        } else {
          result.text = `Order #${order.id} is currently **${order.status}**. Total: ${order.total} ${order.currency}. It was placed on ${new Date(order.date_created).toLocaleDateString()}. ${order.items.length} item(s) included.`;
        }
      }
    } else if (lower.includes('human') || lower.includes('agent') || lower.includes('support') || lower.includes('speak to someone')) {
      result.escalateHuman = true;
      result.text = "I'll connect you with our support team right away!";
    } else if (lower.includes('shipping') || lower.includes('delivery')) {
      result.text = "We offer free shipping on orders over 200 AED! Standard delivery takes 2-5 business days within the UAE.";
    } else if (lower.includes('return') || lower.includes('refund')) {
      result.text = "We have a 30-day return policy on unopened items. If you'd like to initiate a return, I can connect you with our support team, or you can do it from the Order History in the app.";
    } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      const name = userContext.userName ? `, ${userContext.userName}` : '';
      result.text = `Hey${name}! Welcome to MakeupOcean. I'm Mia, your beauty assistant. How can I help you today? I can help you find products, check orders, or answer questions about shipping and returns.`;
    } else {
      result.text = "I'm here to help! I can search our catalog, check your order status, or answer questions about shipping and returns. What would you like to know?";
    }

    return result;
  }

  /**
   * Build Gemini contents array from conversation history.
   * Gemini uses 'user' and 'model' roles (not 'assistant').
   * IMPORTANT: Gemini requires strictly alternating user/model turns.
   * Consecutive same-role messages are merged, and system messages are skipped.
   */
  _buildContents(history, currentMessage) {
    const maxHistory = parseInt(process.env.CHAT_MAX_HISTORY) || 20;
    const trimmed = history.slice(-maxHistory);

    const contents = [];

    for (const msg of trimmed) {
      // Skip system messages — Gemini doesn't support them in contents
      if (msg.role === 'system') continue;

      const role = msg.role === 'user' ? 'user' : 'model';
      const last = contents[contents.length - 1];

      // Merge consecutive same-role messages (Gemini requires alternating turns)
      if (last && last.role === role) {
        last.parts[0].text += '\n' + msg.content;
      } else {
        contents.push({ role, parts: [{ text: msg.content }] });
      }
    }

    // Merge current message into last user turn or create new one
    const last = contents[contents.length - 1];
    if (last && last.role === 'user') {
      last.parts[0].text += '\n' + currentMessage;
    } else {
      contents.push({ role: 'user', parts: [{ text: currentMessage }] });
    }

    // Gemini requires first message to be 'user' — if starts with 'model', prepend empty user
    if (contents.length > 0 && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: '(conversation started)' }] });
    }

    return contents;
  }
}

module.exports = new AIService();
