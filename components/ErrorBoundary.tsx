import * as React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "A critical error occurred in this module.";
      let debugInfo = "";
      
      try {
        if (this.state.errorMessage) {
          const parsed = JSON.parse(this.state.errorMessage);
          if (parsed.operationType && parsed.error) {
            displayMessage = `Database Error: You don't have permission to ${parsed.operationType} this data.`;
            debugInfo = `Path: ${parsed.path} | Error: ${parsed.error}`;
          }
        }
      } catch (e) {
        displayMessage = this.state.errorMessage || displayMessage;
      }

      let title = "System Error";
      let buttonText = "Reload App";
      let isAppUpdated = false;

      if (displayMessage.includes("Failed to fetch dynamically imported module") || 
          displayMessage.includes("Importing a module script failed")) {
        title = "Update Available";
        displayMessage = "The app has been updated in the background. Please click below to load the latest version.";
        buttonText = "Load Latest Version";
        isAppUpdated = true;
      }

      return (
        <div className={`p-8 text-center bg-slate-900 rounded-md border ${isAppUpdated ? 'border-indigo-500/50' : 'border-red-500/50'}`}>
          <h2 className={`text-lg font-semibold font-bold mb-2 ${isAppUpdated ? 'text-indigo-400' : 'text-white'}`}>{title}</h2>
          <p className="text-slate-400 mb-2 text-sm">{displayMessage}</p>
          {!isAppUpdated && debugInfo && <p className="text-red-400 mb-4 text-xs font-mono">{debugInfo}</p>}
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-sm text-xs font-bold"
          >
            {buttonText}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
