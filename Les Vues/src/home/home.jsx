import { useEffect, useState, useRef, useCallback } from 'react';
import homeStyles from './home.module.css';
import MovieGrid from './movieGrid.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Imported the requested Navigation Icons
import { faEnvelope, faMagnifyingGlass, faUser, faPen, faDoorOpen, faHouse, faBookmark, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { filterUnique, cleanExpiredCache, getCachedData, setCachedData, updateCachedData } from '../utils/cacheUtils.js';
import { useAuth } from '../lib/useAuth.jsx';
import Loading from '../utils/loading.jsx'
import { authClient } from "../lib/auth-client.jsx";

function Home() {
    const [visibleMovies, setVisibleMovies] = useState([]);
    const [visibleSeries, setVisibleSeries] = useState([]);
    const [cachedMovies, setCachedMovies] = useState([]);
    const [cachedSeries, setCachedSeries] = useState([]);
    const [networkPage, setNetworkPage] = useState(0);

    // --- Search States ---
    const [movieSearch, setMovieSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchResultPage, setSearchResultPage] = useState(0);
    const [searchTotalPages, setSearchTotalPages] = useState(1);
    const [displaySearchResults, setDisplaySearchResults] = useState(false);

    // --- Profile Related states ---
    const [displayProfileOptions, setDisplayProfileOptions] = useState("none")
    const [displayDialogueBox, setDisplayDialogueBox] = useState('none')

    // --- Observers & Refs ---
    const movieObserver = useRef();
    const seriesObserver = useRef();
    const searchObserver = useRef();
    const isFetching = useRef(false);
    const isFetchingSearch = useRef(false);

    const activeSearchQueryRef = useRef("");
    const abortControllerRef = useRef(null);

    const STOP_WORDS = new Set([
        'a', 'an', 'the', 'of', 'for', 'on', 'at', 'to', 'in',
        'and', 'or', 'but', 'nor', 'so', 'for', 'yet'
    ]);
    const navigate = useNavigate()
    const { isAuthenticated, isPending, user } = useAuth()


    const handleLogout = async () => {
        try {
            const response = await authClient.signOut();
            if (response?.error) {
                console.error("Logout failed.")
                return
            }
            setDisplayDialogueBox('none')
        } catch (error) {
            console.error("Error during log out.")
        }
    }

    const toggleProfileOptions = () => {
        setDisplayProfileOptions(prev => prev === "none" ? "flex" : "none");
    };

    const fetchTrending = async (targetPage, trigger) => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            const cachedMoviesData = getCachedData("trendingMovies");
            const cachedSeriesData = getCachedData("trendingSeries");

            if (cachedMoviesData && cachedSeriesData && trigger === "initial") {
                setVisibleMovies(cachedMoviesData.data);
                setVisibleSeries(cachedSeriesData.data);
                setNetworkPage(cachedMoviesData.page);
                isFetching.current = false;
                return;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/movies/get_popular_movies?page=${targetPage}`);
            const data = await response.json();

            const newMovies = (data.results || []).filter(i => i.media_type === "movie");
            const newSeries = (data.results || []).filter(i => i.media_type === "tv");

            if (trigger === "initial") {
                setVisibleMovies(newMovies);
                setVisibleSeries(newSeries);
                setCachedData("trendingMovies", newMovies, data.page);
                setCachedData("trendingSeries", newSeries, data.page);
            } else if (trigger === "movies") {
                setVisibleMovies(prev => filterUnique(prev, newMovies));
                setVisibleSeries(prev => filterUnique(prev, newSeries));
                updateCachedData("trendingMovies", newMovies, data.page);
                updateCachedData("trendingSeries", newSeries, data.page);
            } else if (trigger === "series") {
                setVisibleSeries(prev => filterUnique(prev, newSeries));
                setVisibleMovies(prev => filterUnique(prev, newMovies));
                updateCachedData("trendingSeries", newSeries, data.page);
                updateCachedData("trendingMovies", newMovies, data.page);
            }
            setNetworkPage(data.page);
        } catch (error) {
            console.error(error);
        } finally {
            isFetching.current = false;
        }
    };


    const queryCleanUp = (query) => {
        return query.toLowerCase().split(' ').filter(word => !STOP_WORDS.has(word)).join(' ')
    }


    const search = async (query, pageToFetch) => {
        const cleanQuery = query;
        if (!cleanQuery) return;

        if (pageToFetch > 1 && isFetchingSearch.current) {
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        isFetchingSearch.current = true;
        const cacheKey = cleanQuery.toLowerCase();

        try {
            const cached = getCachedData(cacheKey);

            if (cached && pageToFetch <= cached.page) {
                if (activeSearchQueryRef.current === cleanQuery) {
                    setSearchResults(cached.data);
                    setSearchResultPage(cached.page);
                    setSearchTotalPages(prev => Math.max(prev, cached.page + 1));
                }
                isFetchingSearch.current = false;
                return;
            }


            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/movies/search?query=${encodeURIComponent(cleanQuery)}&page=${pageToFetch}`,
                { signal: controller.signal }
            );
            const data = await response.json();


            if (activeSearchQueryRef.current !== cleanQuery) {
                return;
            }

            const resultsArray = data.result || data.results || [];
            const apiTotalPages = data.total_pages || data.totalPages || (resultsArray.length > 0 ? pageToFetch + 1 : pageToFetch);
            const apiPage = data.page || pageToFetch;

            if (resultsArray.length === 0) {
                setSearchTotalPages(searchResultPage > 0 ? searchResultPage : 1);
                return;
            }

            setSearchTotalPages(apiTotalPages);

            if (pageToFetch === 1) {
                setSearchResults(resultsArray);
                setSearchResultPage(apiPage);
                setCachedData(cacheKey, resultsArray, apiPage);
            } else {
                setSearchResults(prevResults => {
                    const merged = filterUnique(prevResults, resultsArray);
                    setCachedData(cacheKey, merged, apiPage);
                    return merged;
                });
                setSearchResultPage(apiPage);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`Search for "${cleanQuery}" was aborted.`);
            } else {
                console.error("Search error:", error);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                isFetchingSearch.current = false;
            }
        }
    };


    const searchResultPaginRef = useCallback(node => {
        if (searchObserver.current) searchObserver.current.disconnect();

        searchObserver.current = new IntersectionObserver(entries => {
            const currentQuery = queryCleanUp(movieSearch.trim());

            if (
                entries[0].isIntersecting &&
                !isFetchingSearch.current &&
                currentQuery &&
                currentQuery === activeSearchQueryRef.current &&
                searchResultPage > 0 &&
                searchResultPage < searchTotalPages
            ) {
                search(currentQuery, searchResultPage + 1);
            }
        }, { threshold: 0.1 });

        if (node) {
            searchObserver.current.observe(node);
        } else if (searchObserver.current) {
            searchObserver.current.disconnect();
            searchObserver.current = null;
        }
    }, [movieSearch, searchResultPage, searchTotalPages]);


    const lastMovieElementRef = useCallback(node => {
        if (movieObserver.current) movieObserver.current.disconnect();
        movieObserver.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !isFetching.current) {
                if (cachedMovies.length > 0) {
                    setVisibleMovies(prev => filterUnique(prev, cachedMovies));
                    setCachedMovies([]);
                } else {
                    fetchTrending(networkPage + 1, "movies");
                }
            }
        });
        if (node) {
            movieObserver.current.observe(node);
        } else if (movieObserver.current) {
            movieObserver.current.disconnect();
            movieObserver.current = null;
        }
    }, [cachedMovies, networkPage]);


    const lastSeriesElementRef = useCallback(node => {
        if (seriesObserver.current) seriesObserver.current.disconnect();
        seriesObserver.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !isFetching.current) {
                if (cachedSeries.length > 0) {
                    setVisibleSeries(prev => filterUnique(prev, cachedSeries));
                    setCachedSeries([]);
                } else {
                    fetchTrending(networkPage + 1, "series");
                }
            }
        });

        if (node) {
            seriesObserver.current.observe(node);
        } else if (seriesObserver.current) {
            seriesObserver.current.disconnect();
            seriesObserver.current = null;
        }
    }, [cachedSeries, networkPage]);


    useEffect(() => {
        cleanExpiredCache();
        fetchTrending(1, "initial");
    }, []);


    useEffect(() => {
        const query = queryCleanUp(movieSearch.trim());

        if (!query) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            activeSearchQueryRef.current = "";
            setSearchResults([]);
            setSearchResultPage(0);
            setSearchTotalPages(1);
            setDisplaySearchResults(false);
            return;
        }

        const timer = setTimeout(() => {
            activeSearchQueryRef.current = query;
            setSearchResultPage(0);
            setSearchTotalPages(2);

            search(query, 1);
            setDisplaySearchResults(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, [movieSearch]);


    return (
        <div className={homeStyles.root}>
            <header>
                <h1 style={{ color: 'white', marginLeft: '20px' }}>LesVues</h1>
                
                {/* NEW WRAPPER for Navigation & Profile */}
                <div className={homeStyles.actionContainer}>
                    <div className={homeStyles.Nav}>
                        <nav>
                            <Link to="/">
                                <FontAwesomeIcon icon={faHouse} className={homeStyles.navIcon} />
                                <span className={homeStyles.navText}>Home</span>
                            </Link>
                        </nav>
                        <nav>
                            <Link to="/savedMovies">
                                <FontAwesomeIcon icon={faBookmark} className={homeStyles.navIcon} />
                                <span className={homeStyles.navText}>Saved Movies</span>
                            </Link>
                        </nav>
                        <nav>
                            <Link to="/favorites">
                                <FontAwesomeIcon icon={faHeart} className={homeStyles.navIcon} />
                                <span className={homeStyles.navText}>Favorites</span>
                            </Link>
                        </nav>
                    </div>

                    <div className={homeStyles.profile}>
                        <button className={homeStyles.profileButton} onClick={toggleProfileOptions}>
                            <FontAwesomeIcon icon={faUser} />
                        </button>
                        <div className={homeStyles.profileOptions} style={{ display: `${displayProfileOptions}` }}>
                            {isPending ? (
                                <Loading />
                            ) : isAuthenticated ? (
                                <div>
                                    <div className={homeStyles.profileEmail}>
                                        <p style={{ marginRight: '6px' }}>{user.email}</p>
                                        <button disabled={true}>
                                            <FontAwesomeIcon icon={faEnvelope} />
                                        </button>
                                    </div>
                                    <button className={homeStyles.logoutButton} onClick={() => setDisplayDialogueBox("block")}>
                                        Log Out
                                        <FontAwesomeIcon icon={faDoorOpen} style={{ marginLeft: '10px' }} />
                                    </button>
                                </div>
                            ) : (
                                <div className={homeStyles.loggedOut}>
                                    <Link to="/signup">Sign Up</Link>
                                    <Link to="/signin">Sign In</Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className={homeStyles.search}>
                <div className={homeStyles.searchWrapper}>
                    <div className={homeStyles.searchField}>
                        <input
                            type="text"
                            className={homeStyles.searchInput}
                            placeholder='Search Movies'
                            value={movieSearch}
                            onChange={(e) => setMovieSearch(e.target.value)}
                            onFocus={() => {
                                if (movieSearch.trim() !== "") {
                                    setDisplaySearchResults(true);
                                }
                            }}
                            onBlur={() => {
                                setTimeout(() => setDisplaySearchResults(false), 200);
                            }}
                        />
                    </div>
                    {displaySearchResults && searchResults.length > 0 && (
                        <div className={homeStyles.searchResults}>
                            {searchResults.map(item => (
                                <div key={item.id} className={homeStyles.searchResultItem}
                                    onMouseDown={() => {
                                        const title = item.title || item.name
                                        const key = `${title}_${item.id}`
                                        setCachedData(key, item)
                                        navigate(`/movies/${key}`)
                                    }}
                                >
                                    <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt={item.title || item.name} />
                                    <span>{item.title || item.name}</span>
                                </div>
                            ))}
                            <div ref={searchResultPaginRef} style={{ height: '20px', width: '100%' }} />
                        </div>
                    )}
                </div>
            </div>

            <div className={homeStyles.trendingHeader}>
                <div className={homeStyles.popularMovies}>
                    <MovieGrid title="Trending Movies" items={visibleMovies} />
                    <div ref={lastMovieElementRef} style={{ height: '20px' }} />
                </div>

                <div className={homeStyles.popularMovies}>
                    <MovieGrid title="Popular TV Series" items={visibleSeries} />
                    <div ref={lastSeriesElementRef} style={{ height: '20px' }} />
                </div>
            </div>

            {displayDialogueBox === "block" && (
                <div className={homeStyles.overlay} onClick={() => setDisplayDialogueBox('none')} />
            )}
            
            <div className={homeStyles.dialogueBox}
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
                    <p style={{ fontSize: '20px', color: 'white', fontFamily: 'monospace' }}>
                        Are you sure you want to log out
                    </p>
                    <div className={homeStyles.dialogueBoxOptions} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            style={{ padding: '10px', width: '90px', border: 'none', borderRadius: '20px', backgroundColor: '#ff4040', color: 'white', cursor: 'pointer' }}
                            onClick={handleLogout}
                        >Yes</button>
                        <button
                            style={{ padding: '10px', width: '90px', border: '1px solid #666666', borderRadius: '20px', marginLeft: '10px', backgroundColor: '#505050', color: 'white', cursor: 'pointer' }}
                            onClick={() => setDisplayDialogueBox('none')}
                        >No</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;