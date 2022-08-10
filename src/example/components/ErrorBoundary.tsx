import React from 'react';

export class ErrorBoundary extends React.Component<
  {
    children?: React.ReactNode;
  },
  {
    hasError: boolean;
  }
> {
  public state = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundary['state'] {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <span>Something went wrong!</span>;
    }

    return this.props.children;
  }
}
