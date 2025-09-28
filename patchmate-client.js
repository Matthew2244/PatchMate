/**
 * PatchMate Client API - Modern JavaScript Hook
 * Supports both original and newer authentication methods
 * Auto-detects best endpoint and falls back gracefully
 */

class PatchMateClient {
    constructor(config = {}) {
        this.config = {
            // Primary endpoints (newer method)
            baseUrl: 'https://files.devinecreations.net:3924/apps-devinecr/patchmate-deployment/',
            apiUrl: 'https://files.devinecreations.net:3924/apps-devinecr/patchmate-deployment/api/',
            wsUrl: 'wss://files.devinecreations.net:3924/apps-devinecr/patchmate-deployment/ws/',
            
            // Fallback endpoints (original method)
            fallback: {
                baseUrl: 'https://files.devinecreations.net:3924/patchmate/',
                apiUrl: 'https://files.devinecreations.net:3924/patchmate/api/',
                wsUrl: 'wss://files.devinecreations.net:3924/patchmate/ws/'
            },
            
            // Authentication
            auth: {
                username: 'devinecr',
                password: 'devinecreat-files-2024',
                fallback: {
                    username: 'patchmate',
                    password: 'patchmate-app-2025'
                }
            },
            
            // OpenLink integration
            openlink: 'https://openlink.devinecreations.net/api/patchmate/',
            
            ...config
        };
        
        this.activeEndpoint = null;
        this.activeAuth = null;
        this.websocket = null;
        this.connected = false;
    }

    /**
     * Initialize connection and detect best endpoint
     */
    async initialize() {
        console.log('[PatchMate] Initializing client...');
        
        // Try primary endpoint first
        if (await this.testEndpoint(this.config.baseUrl, this.config.auth)) {
            this.activeEndpoint = {
                base: this.config.baseUrl,
                api: this.config.apiUrl,
                ws: this.config.wsUrl
            };
            this.activeAuth = this.config.auth;
            console.log('[PatchMate] Using primary endpoint (newer method)');
        }
        // Fallback to original endpoint
        else if (await this.testEndpoint(this.config.fallback.baseUrl, this.config.auth.fallback)) {
            this.activeEndpoint = {
                base: this.config.fallback.baseUrl,
                api: this.config.fallback.apiUrl,
                ws: this.config.fallback.wsUrl
            };
            this.activeAuth = this.config.auth.fallback;
            console.log('[PatchMate] Using fallback endpoint (original method)');
        }
        else {
            throw new Error('Unable to connect to any PatchMate endpoint');
        }
        
        this.connected = true;
        return this;
    }

    /**
     * Test endpoint connectivity
     */
    async testEndpoint(url, auth) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${btoa(`${auth.username}:${auth.password}`)}`
                }
            });
            return response.ok;
        } catch (error) {
            console.warn(`[PatchMate] Endpoint test failed for ${url}:`, error.message);
            return false;
        }
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(endpoint, options = {}) {
        if (!this.connected) {
            await this.initialize();
        }

        const url = `${this.activeEndpoint.api}${endpoint}`;
        const headers = {
            'Authorization': `Basic ${btoa(`${this.activeAuth.username}:${this.activeAuth.password}`)}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[PatchMate] API request failed:', error);
            throw error;
        }
    }

    /**
     * Upload file to PatchMate
     */
    async uploadFile(file, path = '') {
        if (!this.connected) {
            await this.initialize();
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const url = `${this.activeEndpoint.base}upload`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${this.activeAuth.username}:${this.activeAuth.password}`)}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Download file from PatchMate
     */
    async downloadFile(filePath) {
        if (!this.connected) {
            await this.initialize();
        }

        const url = `${this.activeEndpoint.base}${filePath}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${btoa(`${this.activeAuth.username}:${this.activeAuth.password}`)}`
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    /**
     * Connect WebSocket for real-time updates
     */
    connectWebSocket(onMessage, onError) {
        if (!this.connected) {
            throw new Error('Client not initialized. Call initialize() first.');
        }

        const wsUrl = `${this.activeEndpoint.ws}?auth=${btoa(`${this.activeAuth.username}:${this.activeAuth.password}`)}`;
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('[PatchMate] WebSocket connected');
        };
        
        this.websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (onMessage) onMessage(data);
            } catch (error) {
                console.error('[PatchMate] WebSocket message parse error:', error);
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('[PatchMate] WebSocket error:', error);
            if (onError) onError(error);
        };
        
        this.websocket.onclose = () => {
            console.log('[PatchMate] WebSocket disconnected');
        };
        
        return this.websocket;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            activeEndpoint: this.activeEndpoint,
            activeAuth: this.activeAuth ? { username: this.activeAuth.username } : null,
            connected: this.connected
        };
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.connected = false;
        console.log('[PatchMate] Client disconnected');
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatchMateClient;
} else if (typeof window !== 'undefined') {
    window.PatchMateClient = PatchMateClient;
}

// Usage examples:
/*
// Basic usage
const client = new PatchMateClient();
await client.initialize();

// Upload a file
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
const result = await client.uploadFile(file, 'patches/');

// Make API request
const data = await client.apiRequest('status');

// Connect WebSocket
client.connectWebSocket(
    (message) => console.log('Received:', message),
    (error) => console.error('WS Error:', error)
);

// Get current config
console.log(client.getConfig());
*/