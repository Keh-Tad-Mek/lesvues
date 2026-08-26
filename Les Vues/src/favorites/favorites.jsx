import { useEffect, useState, useRef, useCallback } from 'react';
import favoriteStyles from './favorites.module.css';
import { authClient } from "../lib/auth-client.jsx";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUser, faDoorOpen, faEnvelope, faPen, faHouse, faBookmark, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';
import Loading from '../utils/loading.jsx';
import { setCachedData, getCachedData } from '../utils/cacheUtils.js';

const CACHE_KEY = 'favorite_movies_list';
const STALE_KEY = 'favorite_movies_list_stale';

function Favorites() {
    const [favoriteMovies, setFavoriteMovies] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    
    // UI States
    const [displayProfileOptions, setDisplayProfileOptions] = useState("none");
    const [displayDialogueBox, setDisplayDialogueBox] = useState('none');
    const [hoveredId, setHoveredId] = useState(null)

    // Refs for functional guardrails
    const isFetching = useRef(false);
    const observerRef = useRef();
    const existingIds = useRef(new Set()); 
    
    const navigate = useNavigate();
    const { isAuthenticated, isPending, user } = useAuth();

    const handleLogout = async () => {
        try {
            const response = await authClient.signOut();
            if (response?.error) {
                console.error("Logout failed.");
                return;
            }
            localStorage.removeItem('saved_movies_list');
            localStorage.removeItem('saved_movies_list_stale');
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(STALE_KEY);
            setDisplayDialogueBox('none');
        } catch (error) {
            console.error("Error during log out.");
        }
    };

    const toggleProfileOptions = () => {
        setDisplayProfileOptions(prev => prev === "none" ? "flex" : "none");
    };

    const fetchFavorites = async (targetPage) => {
        if (isFetching.current || !hasMore) return;
        isFetching.current = true;

        const isStale = localStorage.getItem(STALE_KEY);
        const cached = getCachedData(CACHE_KEY);
        
        if (cached && !isStale && targetPage <= cached.page) {
            if (targetPage === 1) {
                setFavoriteMovies(cached.data);
                existingIds.current.clear();
                cached.data.forEach(m => existingIds.current.add(m.movie_id || m.id));
                setPage(cached.page);
            }
            isFetching.current = false;
            return;
        }

        try {
            // add base URL here
            const response = await fetch(`/api/personal/favorites?page=${targetPage}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });

            if (response.status === 404) {
                setHasMore(false);
                return;
            }

            const data = await response.json();

            let newMovies = [];
            if (Array.isArray(data)) newMovies = data;
            else if (data?.data && Array.isArray(data.data)) newMovies = data.data;
            else if (data?.favorites && Array.isArray(data.favorites)) newMovies = data.favorites;
            else if (data?.results && Array.isArray(data.results)) newMovies = data.results;
            else if (data?.movies && Array.isArray(data.movies)) newMovies = data.movies;

            if (newMovies.length === 0) {
                setHasMore(false);
                return;
            }

            const uniqueNew = newMovies.filter(m => !existingIds.current.has(m.movie_id || m.id));
            
            if (uniqueNew.length === 0 && newMovies.length > 0) {
                setHasMore(false);
            } else {
                uniqueNew.forEach(m => existingIds.current.add(m.movie_id || m.id));
                
                setFavoriteMovies(prev => {
                    const updatedMovies = (targetPage === 1 && isStale) 
                        ? [...uniqueNew] 
                        : [...prev, ...uniqueNew];
                        
                    setCachedData(CACHE_KEY, updatedMovies, targetPage);
                    localStorage.removeItem(STALE_KEY); 

                    return updatedMovies;
                });
                
                setPage(targetPage);
                
                if (newMovies.length < 10) {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.error("Error fetching favorites:", error);
            setHasMore(false); 
        } finally {
            isFetching.current = false;
        }
    };

    const removeFavorite = async (movieId, e) => {
        e.stopPropagation();
        
        localStorage.setItem(STALE_KEY, Date.now().toString());
        
        const previousFavorites = [...favoriteMovies];
        const updatedFavorites = favoriteMovies.filter(item => (item.movie_id || item.id) !== movieId);
        
        setFavoriteMovies(updatedFavorites);
        existingIds.current.delete(movieId);
        setCachedData(CACHE_KEY, updatedFavorites, page);

        try {
            // add base URL here
            const response = await fetch(`/api/personal/favorites/${movieId}`, {
                method: "DELETE",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Deletion failed");
            }
        } catch (error) {
            setFavoriteMovies(previousFavorites);
            existingIds.current.add(movieId);
            setCachedData(CACHE_KEY, previousFavorites, page);
        }
    };

    const lastElementRef = useCallback(node => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isFetching.current) {
                fetchFavorites(page + 1);
            }
        }, { threshold: 0.1 });

        if (node) {
            observerRef.current.observe(node);
        }
    }, [page, hasMore]); 

    useEffect(() => {
        if (favoriteMovies.length === 0) {
            existingIds.current.clear();
        }
        fetchFavorites(1);
    }, []);

    return (
        <div className={favoriteStyles.root}>
            <header>
                <h1 style={{ color: 'white', marginLeft: '20px' }}>LesVues</h1>
                
                <div className={favoriteStyles.actionContainer}>
                    <div className={favoriteStyles.Nav}>
                        <nav>
                            <Link to="/">
                                <span className={favoriteStyles.navText}>Home</span>
                                <FontAwesomeIcon icon={faHouse} className={favoriteStyles.navIcon} />
                            </Link>
                        </nav>
                        <nav>
                            <Link to="/savedMovies">
                                <span className={favoriteStyles.navText}>Saved Movies</span>
                                <FontAwesomeIcon icon={faBookmark} className={favoriteStyles.navIcon} />
                            </Link>
                        </nav>
                        <nav>
                            <Link to="/favorites">
                                <span className={favoriteStyles.navText}>Favorites</span>
                                <FontAwesomeIcon icon={faHeart} className={favoriteStyles.navIcon} />
                            </Link>
                        </nav>
                    </div>

                    <div className={favoriteStyles.profile}>
                        <button className={favoriteStyles.profileButton} onClick={toggleProfileOptions}>
                            <FontAwesomeIcon icon={faUser} />
                        </button>
                        <div className={favoriteStyles.profileOptions} style={{ display: `${displayProfileOptions}` }}>
                            {isPending ? (
                                <Loading />
                            ) : isAuthenticated ? (
                                <div>
                                    <div className={favoriteStyles.profileEmail}>
                                        <p style={{ marginRight: '6px' }}>{user?.email}</p>
                                        <button disabled={true}><FontAwesomeIcon icon={faEnvelope} /></button>
                                    </div>
                                    <button className={favoriteStyles.logoutButton} onClick={() => setDisplayDialogueBox("block")}>
                                        Log Out
                                        <FontAwesomeIcon icon={faDoorOpen} style={{ marginLeft: '10px' }} />
                                    </button>
                                </div>
                            ) : (
                                <div className={favoriteStyles.loggedOut}>
                                    <Link to="/signup">Sign Up</Link>
                                    <Link to="/signin">Sign In</Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
                        
            <div className={favoriteStyles.favoritesContainer}>
                <h2>Your Favorites</h2>
                {!isAuthenticated ? (
                    <div className={favoriteStyles.authPrompt}>
                        <p>
                            <Link to="/signin" className={favoriteStyles.authLink}>Sign in</Link>
                            <span> to save and access your favorites.</span>
                        </p>
                    </div>
                ) : favoriteMovies.length === 0 && !hasMore ? (
                    <p className={favoriteStyles.emptyMessage}>No saved movies found in your favorites.</p>
                ) : (
                    <div className={favoriteStyles.movieGrid}>
                        {favoriteMovies.map((item) => {
                            const itemId = item.movie_id || item.id;
                            
                            return (
                                <div 
                                    key={itemId} 
                                    className={favoriteStyles.movieCard}
                                    onMouseOver={(e) => setHoveredId(item.movie_id)}
                                    onMouseLeave={(e) => setHoveredId(null)}
                                    onClick={() => {
                                        const movieTitle = item.title || item.name;
                                        const key = `${movieTitle}_${item.movie_id}`;
                                        setCachedData(key, item);
                                        navigate(`/movies/${key}`);
                                    }}
                                >
                                    <div className={favoriteStyles.moviecardheader}
                                        style={{ 
                                            display: hoveredId === item.movie_id ? "flex" : "none"
                                        }}     
                                    >
                                        <button 
                                            className={favoriteStyles.removeButton}
                                            onClick={(e) => removeFavorite(itemId, e)}
                                        >
                                            <FontAwesomeIcon icon={faXmark} />
                                        </button>
                                    </div>
                                    <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title} />
                                    <h3>{item.title}</h3>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div ref={lastElementRef} style={{ height: '20px', width: '100%' }} />
            </div>

            {displayDialogueBox === "block" && (
                <div className={favoriteStyles.overlay} onClick={() => setDisplayDialogueBox('none')} />
            )}
            <div className={favoriteStyles.dialogueBox}
                style={{
                    width: 'max-content',
                    padding: '20px',
                    backgroundColor: 'hsl(0, 0%, 17%)',
                    border: '1px solid #494949',
                    borderRadius: '6px',
                    display: `${displayDialogueBox}`
                }}
            >
                <div>
                    <p style={{ fontSize: '20px', color: 'white', fontFamily: 'monospace' }}>Are you sure you want to log out</p>
                    <div className={favoriteStyles.dialogueBoxOptions} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button style={{ padding: '10px', width: '90px', border: 'none', borderRadius: '20px', backgroundColor: '#ff4040', color: 'white' }} onClick={handleLogout}>Yes</button>
                        <button style={{ padding: '10px', width: '90px', border: '1px solid #666666', borderRadius: '20px', marginLeft: '10px', backgroundColor: '#505050', color: 'white' }} onClick={() => setDisplayDialogueBox('none')}>No</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Favorites;
