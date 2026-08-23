import { useState } from 'react';
import homeStyles from './home.module.css';
import { useNavigate } from 'react-router-dom';
import { setCachedData } from '../utils/cacheUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faEllipsisV, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

export default function MovieGrid({ title, items }) {
    if (!items || items.length === 0) return null;
    
    const [hoveredId, setHoveredId] = useState(null);
    const [optionsId, setOptionsId] = useState(null); 
    
    // Toast notification state
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    
    const navigate = useNavigate();

    const triggerToast = (message, type) => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3500); // Disappears after 3.5 seconds
    };

    const saveMovies = async (destination, movie) => {
        if (!destination || !movie) return;
        if (destination !== "Favorites" && destination !== "Watch Later") return;
        if (!(typeof movie === 'object')) return;

        if (!((movie.id && typeof movie.id === 'number') && 
            ((movie.title && typeof movie.title === 'string') || 
            (movie.name && typeof movie.name === 'string')) &&
            (movie.backdrop_path && 
            typeof movie.backdrop_path === 'string' &&
            movie.backdrop_path[0] === '/') &&
            (movie.poster_path && 
            typeof movie.poster_path === 'string' &&
            movie.poster_path[0] === '/') &&
            (movie.overview && typeof movie.overview === 'string') &&
            (movie.media_type && 
            (movie.media_type === 'tv' || movie.media_type === 'movie')) &&
            (movie.vote_average !== undefined &&
            typeof movie.vote_average === 'number' && 
            movie.vote_average >= 0 &&
            movie.vote_average <= 10)
        )) return;

        const ID = movie.id;
        const movieTitle = movie.title || movie.name;
        const backDropPath = movie.backdrop_path;
        const posterPath = movie.poster_path;
        const overview = movie.overview;
        const mediaType = movie.media_type;
        const rating = movie.vote_average;

        let route = destination === "Favorites" ? "favorites" : "saveForLater";

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/personal/${route}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    "id": ID,
                    "title": movieTitle,
                    "backDropPath": backDropPath,
                    "posterPath": posterPath,
                    "overview": overview,
                    "mediaType": mediaType,
                    "rating": rating
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Set stale flag based on destination to force refetch when visiting saved pages
                if (destination === "Favorites") {
                    localStorage.setItem('favorite_movies_list_stale', Date.now().toString());
                } else if (destination === "Watch Later") {
                    localStorage.setItem('saved_movies_list_stale', Date.now().toString());
                }

                triggerToast(`"${movieTitle}" saved to ${destination}!`, 'success');
            } else {
                triggerToast(data.error || 'Save failed. Please try again.', 'error');
            }
        } catch (error) {
            triggerToast('Network error. Save failed.', 'error');
        }
    };

    return (
        <div className={homeStyles.section}>
            <h2>{title}</h2>
            <div className={homeStyles.popularMovies}>
                {items.map(item => (
                    <div 
                        key={item.id}
                        className={homeStyles.movieCard}
                        onClick={() => {
                            const movieTitle = item.title || item.name;
                            const key = `${movieTitle}_${item.id}`;
                            setCachedData(key, item);
                            navigate(`/movies/${key}`);
                        }}
                        onMouseOver={() => setHoveredId(item.id)}
                        onMouseLeave={() => {
                            setHoveredId(null);
                            setOptionsId(null);
                        }}
                    >
                        <div className={homeStyles.moviecardheader}
                            style={{ display: hoveredId === item.id ? "flex" : "none" }}
                        >
                            <div className={homeStyles.rating}>
                                <FontAwesomeIcon icon={faStar} style={{ color: 'gold', fontSize: '11px', marginRight: '5px' }}/>
                                <p style={{ color: 'white', fontSize: '13px' }}> {( Math.round(item.vote_average * 10) / 10 )} </p>
                            </div>
                            <button className={homeStyles.cardExtras}
                                style={{ border: 'none', backgroundColor: 'transparent' }}
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    setOptionsId(optionsId === item.id ? null : item.id);
                                }}
                            >
                                <FontAwesomeIcon icon={faEllipsisV} style={{ fontSize:'18px', color: 'white' }}/>
                            </button>
                        </div>

                        <div className={homeStyles.cardOptions}
                            style={{
                                display: optionsId === item.id ? "flex" : "none",
                                flexDirection: "column",
                                width: 'max-content',
                                borderRadius:'6px'
                            }}
                        >
                            <button className={homeStyles.cardButtons}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    saveMovies("Favorites", item);
                                    setOptionsId(null);
                                }}
                                style={{ borderTopLeftRadius:'6px', borderTopRightRadius:'6px' }}
                            >Add To Favorites</button>
                            <button className={homeStyles.cardButtons}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    saveMovies("Watch Later", item);
                                    setOptionsId(null);
                                }}
                                style={{ border:'none', borderBottomLeftRadius:'6px', borderBottomRightRadius:'6px' }}
                            >Save For Later</button>
                        </div>

                        <img src={`https://image.tmdb.org/t/p/original${item.poster_path}`} alt={item.title || item.name} />
                        <h3>{item.title || item.name}</h3>
                    </div>
                ))}
            </div>

            {/* Floating Toast Notification Pop-up */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 20px',
                    backgroundColor: 'hsl(0, 0%, 15%)',
                    border: `1px solid ${toast.type === 'success' ? '#2ecc71' : '#e74c3c'}`,
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    animation: 'fadeInOut 0.3s ease'
                }}>
                    <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: toast.type === 'success' ? '#2ecc71' : '#e74c3c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px'
                    }}>
                        <FontAwesomeIcon icon={toast.type === 'success' ? faCheck : faXmark} />
                    </div>
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}