import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="font-mono text-gold-500 text-sm mb-2">404</p>
      <h1 className="font-display font-bold text-2xl mb-4">Page not found</h1>
      <Link to="/" className="btn-gold">Back home</Link>
    </div>
  );
}
