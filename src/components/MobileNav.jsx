import { Globe2, Home as HomeIcon, PlayCircle, Search } from 'lucide-react';
import { categoryRoutes } from '../constants/navigation.js';

export function MobileNav({ copy, navigateCategory, navigateHome, setMobileSearchOpen }) {
  return (
    <div className="mobileNav">
      <a href="/" onClick={(event) => {
        event.preventDefault();
        navigateHome();
      }}>
        <HomeIcon size={18} /> {copy.home}
      </a>
      <a href={categoryRoutes.local} onClick={(event) => {
        event.preventDefault();
        navigateCategory('local');
      }}>
        <Globe2 size={18} /> {copy.categories.local}
      </a>
      <a href={categoryRoutes.live} onClick={(event) => {
        event.preventDefault();
        navigateCategory('live');
      }}>
        <PlayCircle size={18} /> {copy.categories.live}
      </a>
      <a href={categoryRoutes.video} onClick={(event) => {
        event.preventDefault();
        navigateCategory('video');
      }}>
        <PlayCircle size={18} /> {copy.categories.video}
      </a>
      <button type="button" onClick={() => setMobileSearchOpen((value) => !value)}>
        <Search size={18} /> {copy.search}
      </button>
    </div>
  );
}
