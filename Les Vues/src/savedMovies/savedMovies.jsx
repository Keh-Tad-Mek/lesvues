import { useEffect, useState, useRef, useCallback } from 'react';
import styles from './savedMovies.module.css';
import { authClient } from "../lib/auth-client.jsx";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faUser, faDoorOpen, faEnvelope, faPen, faHouse, faBookmark, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';
import Loading from '../utils/loading.jsx';
import { setCachedData, getCachedData } from '../utils/cacheUtils.js';

const CACHE_KEY = 'saved_movies_list';
const STALE_KEY = 'saved_movies_list_stale';

function SavedMovies() {
    const [savedMovies, setSavedMovies] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    
    // UI States
    const [displayProfileOptions, setDisplayProfileOptions] = useState("none");
    const [displayDialogueBox, setDisplayDialogueBox] = useState('none');
    const [hoveredId, setHoveredId] = useState(null);

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
            // Clear sensitive lists and stale flags from cache on logout
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(STALE_KEY);
            localStorage.removeItem('favorite_movies_list');
            localStorage.removeItem('favorite_movies_list_stale');
            setDisplayDialogueBox('none');
        } catch (error) {
            console.error("Error during log out.");
        }
    };

    const toggleProfileOptions = () => {
        setDisplayProfileOptions(prev => prev === "none" ? "flex" : "none");
    };

    const fetchSavedMovies = async (targetPage) => {
        if (isFetching.current || !hasMore) return;
        isFetching.current = true;

        // --- CACHE & STALE CHECK ---
        const isStale = localStorage.getItem(STALE_KEY);
        const cached = getCachedData(CACHE_KEY);
        
        // Only use cache if it exists, the page is within range, AND no changes have been made to the DB
        if (cached && !isStale && targetPage <= cached.page) {
            if (targetPage === 1) {
                setSavedMovies(cached.data);
                existingIds.current.clear();
                cached.data.forEach(m => existingIds.current.add(m.movie_id || m.id));
                setPage(cached.page);
            }
            isFetching.current = false;
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/personal/saveForLater?page=${targetPage}`, {
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
            else if (data?.savedMovies && Array.isArray(data.savedMovies)) newMovies = data.savedMovies;
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
                
                setSavedMovies(prev => {
                    // If we are fetching page 1 because it was stale, overwrite instead of appending
                    const updatedMovies = (targetPage === 1 && isStale) 
                        ? [...uniqueNew] 
                        : [...prev, ...uniqueNew];
                    
                    // --- UPDATE CACHE & REMOVE STALE FLAG ---
                    setCachedData(CACHE_KEY, updatedMovies, targetPage);
                    localStorage.removeItem(STALE_KEY); // Cache is now up to date with DB
                    
                    return updatedMovies;
                });
                
                setPage(targetPage);
                
                if (newMovies.length < 10) {
                    setHasMore(false);
                }
            }
        } catch (error) {
            console.error("Error fetching saved movies:", error);
            setHasMore(false);
        } finally {
            isFetching.current = false;
        }
    };

    const removeSavedMovie = async (movieId, title, e) => {
        e.stopPropagation();
        
        // --- MARK CACHE AS STALE ---
        localStorage.setItem(STALE_KEY, Date.now().toString());

        const previousMovies = [...savedMovies];
        const updatedMovies = savedMovies.filter(item => (item.movie_id || item.id) !== movieId);
        
        setSavedMovies(updatedMovies);
        existingIds.current.delete(movieId);
        setCachedData(CACHE_KEY, updatedMovies, page); // Optimistic UI update

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/personal/saveForLater/${movieId}`, {
                method: "DELETE",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Deletion failed");
            }
        } catch (error) {
            // Rollback if DB fails
            setSavedMovies(previousMovies);
            existingIds.current.add(movieId);
            setCachedData(CACHE_KEY, previousMovies, page);
        }

    };

    const lastElementRef = useCallback(node => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !isFetching.current) {
                fetchSavedMovies(page + 1);
            }
        }, { threshold: 0.1 });

        if (node) {
            observerRef.current.observe(node);
        }
    }, [page, hasMore]);

    useEffect(() => {
        if (savedMovies.length === 0) {
            existingIds.current.clear();
        }
        fetchSavedMovies(1);
    }, []);

    return (
        <div className={styles.root}>
            <header>
                <h1 style={{ color: 'white', marginLeft: '20px' }}>LesVues</h1>
                
                {/* Wrapped Nav and Profile inside actionContainer for responsive handling */}
                <div className={styles.actionContainer}>
                    <div className={styles.Nav}>
                        <nav>
                            <Link to="/">
                                <FontAwesomeIcon icon={faHouse} className={styles.navIcon} />
                                <span className={styles.navText}>Home</span>
                            </Link>
                        </nav>
                        <nav>
                            <Link to="/savedMovies">
                                <FontAwesomeIcon icon={faBookmark} className={styles.navIcon} />
                                <span className={styles.navText}>Saved Movies</span>
                            </Link>
                        </nav>
                        <nav>
                            <Link to="/favorites">
                                <FontAwesomeIcon icon={faHeart} className={styles.navIcon} />
                                <span className={styles.navText}>Favorites</span>
                            </Link>
                        </nav>
                    </div>
                    <div className={styles.profile}>
                        <button className={styles.profileButton} onClick={toggleProfileOptions}>
                            <FontAwesomeIcon icon={faUser} />
                        </button>
                        <div className={styles.profileOptions} style={{ display: `${displayProfileOptions}` }}>
                            {isPending ? (
                                <Loading />
                            ) : isAuthenticated ? (
                                <div>
                                    <div className={styles.profileEmail}>
                                        <p style={{ marginRight: '6px' }}>{user?.email}</p>
                                        <button disabled={true}><FontAwesomeIcon icon={faEnvelope} /></button>
                                    </div>
                                    <button className={styles.logoutButton} onClick={() => setDisplayDialogueBox("block")}>
                                        Log Out
                                        <FontAwesomeIcon icon={faDoorOpen} style={{ marginLeft: '10px' }} />
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.loggedOut}>
                                    <Link to="/signup">Sign Up</Link>
                                    <Link to="/signin">Sign In</Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
                        
            <div className={styles.savedContainer}>
                <h2>Saved Movies</h2>
                {!isAuthenticated ? (
                    <div className={styles.authPrompt}>
                        <p>
                            <Link to="/signin" className={styles.authLink}>Sign in</Link>
                            <span> to save and access your movies.</span>
                        </p>
                    </div>
                ) : savedMovies.length === 0 && !hasMore ? (
                    <p className={styles.emptyMessage}>No saved movies found.</p>
                ) : (
                    <div className={styles.movieGrid}>
                        {savedMovies.map((item) => {
                            return (
                                <div 
                                    key={item.movie_id} 
                                    className={styles.movieCard}
                                    onMouseOver={() => setHoveredId(item.movie_id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    onClick={() => {
                                        const movieTitle = item.title || item.name;
                                        const key = `${movieTitle}_${item.movie_id}`;
                                        setCachedData(key, item);
                                        navigate(`/movies/${key}`);
                                    }}
                                >
                                    <div className={styles.moviecardheader}
                                        style={{ display: hoveredId === item.movie_id ? "flex" : "none" }}     
                                    >
                                        <button 
                                            className={styles.removeButton}
                                            onClick={(e) => removeSavedMovie(item.movie_id, item.title, e)}
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
                <div className={styles.overlay} onClick={() => setDisplayDialogueBox('none')} />
            )}
            <div className={styles.dialogueBox}
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
                    <div className={styles.dialogueBoxOptions} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button style={{ padding: '10px', width: '90px', border: 'none', borderRadius: '20px', backgroundColor: '#ff4040', color: 'white' }} onClick={handleLogout}>Yes</button>
                        <button style={{ padding: '10px', width: '90px', border: '1px solid #666666', borderRadius: '20px', marginLeft: '10px', backgroundColor: '#505050', color: 'white' }} onClick={() => setDisplayDialogueBox('none')}>No</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SavedMovies;