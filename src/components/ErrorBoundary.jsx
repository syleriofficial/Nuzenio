import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Nuzenio render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="errorBoundary" role="alert">
          <div>
            <b>Nuzenio could not load this view.</b>
            <p>Please refresh the page. Live news services are still available from the navigation after reload.</p>
            <button type="button" onClick={() => window.location.reload()}>Refresh Nuzenio</button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
