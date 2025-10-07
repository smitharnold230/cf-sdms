/**
 * Enhanced Error Pages and User-Friendly Error Handling
 */

export interface ErrorPageOptions {
  title?: string;
  message?: string;
  statusCode?: number;
  showDetails?: boolean;
  supportEmail?: string;
  actionButton?: {
    text: string;
    url: string;
  };
}

/**
 * Generate HTML error page
 */
export function generateErrorPage(error: Error | string, options: ErrorPageOptions = {}): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const statusCode = options.statusCode || 500;
  const title = options.title || getDefaultTitle(statusCode);
  const userMessage = options.message || getDefaultMessage(statusCode);
  const showDetails = options.showDetails || false;
  const supportEmail = options.supportEmail || 'support@sdms.workers.dev';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - SDMS</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        
        .error-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 90%;
            padding: 40px;
            text-align: center;
        }
        
        .error-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            opacity: 0.7;
        }
        
        .error-title {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 10px;
            color: #2d3748;
        }
        
        .error-message {
            font-size: 1.1rem;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .error-details {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            color: #2d3748;
        }
        
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 30px;
        }
        
        .btn {
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
            font-size: 1rem;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a67d8;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background: #edf2f7;
            color: #4a5568;
        }
        
        .btn-secondary:hover {
            background: #e2e8f0;
        }
        
        .support-info {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
            font-size: 0.9rem;
        }
        
        .error-code {
            display: inline-block;
            background: #fed7d7;
            color: #9b2c2c;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            margin-bottom: 10px;
        }

        @media (max-width: 480px) {
            .error-container {
                padding: 30px 20px;
            }
            
            .error-title {
                font-size: 1.5rem;
            }
            
            .action-buttons {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">${getErrorIcon(statusCode)}</div>
        <div class="error-code">Error ${statusCode}</div>
        <h1 class="error-title">${title}</h1>
        <p class="error-message">${userMessage}</p>
        
        ${showDetails ? `<div class="error-details">
            <strong>Technical Details:</strong><br>
            ${errorMessage}
        </div>` : ''}
        
        <div class="action-buttons">
            <a href="/" class="btn btn-primary">
                🏠 Go Home
            </a>
            ${options.actionButton ? `
            <a href="${options.actionButton.url}" class="btn btn-secondary">
                ${options.actionButton.text}
            </a>
            ` : `
            <a href="javascript:history.back()" class="btn btn-secondary">
                ← Go Back
            </a>
            `}
        </div>
        
        <div class="support-info">
            <p>If this problem persists, please contact our support team:</p>
            <a href="mailto:${supportEmail}" style="color: #667eea; text-decoration: none;">
                📧 ${supportEmail}
            </a>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Get default title for status code
 */
function getDefaultTitle(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'Bad Request';
    case 401: return 'Authentication Required';
    case 403: return 'Access Denied';
    case 404: return 'Page Not Found';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    case 502: return 'Service Unavailable';
    case 503: return 'Service Temporarily Unavailable';
    case 504: return 'Gateway Timeout';
    default: return 'Something Went Wrong';
  }
}

/**
 * Get default user-friendly message for status code
 */
function getDefaultMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'The request you made couldn\'t be processed. Please check your input and try again.';
    case 401:
      return 'You need to sign in to access this page. Please log in and try again.';
    case 403:
      return 'You don\'t have permission to access this resource. Please contact your administrator if you believe this is an error.';
    case 404:
      return 'The page you\'re looking for doesn\'t exist. It might have been moved, deleted, or you entered the wrong URL.';
    case 429:
      return 'You\'ve made too many requests. Please wait a moment and try again.';
    case 500:
      return 'Something went wrong on our end. We\'ve been notified and are working to fix it.';
    case 502:
      return 'We\'re having trouble connecting to our services. Please try again in a few minutes.';
    case 503:
      return 'The service is temporarily unavailable for maintenance. Please try again later.';
    case 504:
      return 'The request took too long to process. Please try again.';
    default:
      return 'An unexpected error occurred. Our team has been notified and is investigating.';
  }
}

/**
 * Get emoji icon for status code
 */
function getErrorIcon(statusCode: number): string {
  switch (statusCode) {
    case 400: return '⚠️';
    case 401: return '🔐';
    case 403: return '🚫';
    case 404: return '🔍';
    case 429: return '⏱️';
    case 500: return '🛠️';
    case 502: return '🔌';
    case 503: return '⏳';
    case 504: return '⏰';
    default: return '❌';
  }
}

/**
 * Generate JSON error response with user-friendly format
 */
export function generateJsonError(
  error: Error | string,
  statusCode: number = 500,
  requestId?: string
): Response {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const errorResponse = {
    success: false,
    error: {
      message: getDefaultMessage(statusCode),
      code: statusCode,
      technical: errorMessage,
      requestId: requestId || generateRequestId(),
      timestamp: new Date().toISOString()
    }
  };

  return new Response(JSON.stringify(errorResponse, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': errorResponse.error.requestId
    }
  });
}

/**
 * Generate HTML error response
 */
export function generateHtmlError(
  error: Error | string,
  statusCode: number = 500,
  options: ErrorPageOptions = {}
): Response {
  const html = generateErrorPage(error, { statusCode, ...options });
  
  return new Response(html, {
    status: statusCode,
    headers: {
      'Content-Type': 'text/html',
      'X-Request-ID': generateRequestId()
    }
  });
}

/**
 * Smart error response that returns JSON or HTML based on Accept header
 */
export function smartErrorResponse(
  request: Request,
  error: Error | string,
  statusCode: number = 500,
  options: ErrorPageOptions = {}
): Response {
  const acceptHeader = request.headers.get('Accept') || '';
  
  // Check if client prefers JSON
  if (acceptHeader.includes('application/json') || 
      request.url.includes('/api/') ||
      request.headers.get('Content-Type')?.includes('application/json')) {
    return generateJsonError(error, statusCode);
  }
  
  // Default to HTML error page
  return generateHtmlError(error, statusCode, options);
}

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `req_${timestamp}_${random}`;
}

/**
 * Maintenance page generator
 */
export function generateMaintenancePage(
  estimatedDuration?: string,
  message?: string
): Response {
  const defaultMessage = 'We\'re performing scheduled maintenance to improve your experience.';
  const maintenanceMessage = message || defaultMessage;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maintenance Mode - SDMS</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .maintenance-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
        }
        .maintenance-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        .maintenance-title {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: #2d3748;
        }
        .maintenance-message {
            font-size: 1.1rem;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .estimated-time {
            background: #fff5f5;
            border: 1px solid #feb2b2;
            border-radius: 8px;
            padding: 15px;
            color: #c53030;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="maintenance-container">
        <div class="maintenance-icon">🔧</div>
        <h1 class="maintenance-title">Under Maintenance</h1>
        <p class="maintenance-message">${maintenanceMessage}</p>
        ${estimatedDuration ? `
        <div class="estimated-time">
            ⏱️ Estimated completion: ${estimatedDuration}
        </div>
        ` : ''}
    </div>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html',
      'Retry-After': '3600' // 1 hour
    }
  });
}