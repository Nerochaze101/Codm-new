import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, Match } from './types';
import {
  fetchUser, fetchMatches, fetchMatch, createMatch, joinMatch,
  opponentStakeMatch, creatorStakeMatch,
  cancelMatch, submitMatchResult,
  createUser, signUpUser, signInUser, updateUser, withdrawWallet
} from './services/api';
import { Navbar } from './components/Navbar';
import { BottomNavbar } from './components/BottomNavbar';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { CoreArena } from './components/CoreArena';
import { RulesPage } from './components/RulesPage';
import { HistoryPage } from './components/HistoryPage';
import { ProfilePage } from './components/ProfilePage';
import { CreateBetModal } from './components/CreateBetModal';
import { OpponentOnboardingModal } from './components/OpponentOnboardingModal';

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'guest',
    username: 'Gamer',
    codmIgn: 'CODM_Gamer',
    codmUid: '0000000000000000',
    email: '',
    phone: '',
    balance: 0,
    escrowBalance: 0,
    totalWinnings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=gamer',
    transactions: [],
  });
  const [matches, setMatches] = useState<Match[]>([]);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  // Modals & configuration
  const [isCreateBetOpen, setIsCreateBetOpen] = useState(false);
  const [createBetInitialMode, setCreateBetInitialMode] = useState<string | undefined>(undefined);
  const [createBetInitialStake, setCreateBetInitialStake] = useState<number | undefined>(undefined);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingTargetMatch, setOnboardingTargetMatch] = useState<Match | null>(null);

  // Determine current tab from pathname
  const pathname = location.pathname;
  let currentTab = 'landing';
  if (pathname === '/auth') currentTab = 'auth';
  else if (pathname === '/arena') currentTab = 'arena';
  else if (pathname === '/rules') currentTab = 'rules';
  else if (pathname === '/history') currentTab = 'history';
  else if (pathname === '/profile') currentTab = 'profile';

  // Initial Data Fetch & URL Deep Link Check
  useEffect(() => {
    loadInitialSessionAndData();

    // Check URL query parameters for ?join=MATCH_ID
    const urlParams = new URLSearchParams(window.location.search);
    const joinMatchId = urlParams.get('join');
    if (joinMatchId) {
      handleDeepLinkJoin(joinMatchId);
    }
  }, []);

  const loadInitialSessionAndData = async () => {
    try {
      const savedUserId = localStorage.getItem('codm_current_user_id');
      if (savedUserId) {
        try {
          const activeUser = await fetchUser(savedUserId);
          setCurrentUser(activeUser);
          if (window.location.pathname === '/' || window.location.pathname === '/landing') {
            navigate('/arena');
          }
        } catch (e) {
          console.error('Could not load saved user:', e);
          navigate('/auth');
        }
      } else {
        navigate('/auth');
      }
      const mList = await fetchMatches();
      setMatches(mList);
    } catch (e) {
      console.error(e);
      navigate('/auth');
    }
  };

  const loadData = async (userToFetchId?: string) => {
    try {
      const uid = userToFetchId || currentUser.id;
      const u = await fetchUser(uid);
      setCurrentUser(u);
      const mList = await fetchMatches();
      setMatches(mList);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeepLinkJoin = async (matchId: string) => {
    try {
      const match = await fetchMatch(matchId);
      if (match && match.status === 'PENDING_OPPONENT_STAKE') {
        setOnboardingTargetMatch(match);
        setIsOnboardingModalOpen(true);
      } else if (match) {
        navigate('/arena');
      }
    } catch (err) {
      console.error('Deep link match lookup error:', err);
    }
  };

  const handleOpenCreateBet = (mode?: string, stake?: number) => {
    setCreateBetInitialMode(mode);
    setCreateBetInitialStake(stake);
    setIsCreateBetOpen(true);
  };

  const handleCreateBet = async (data: {
    stakeAmount: number;
    gameMode: string;
    map: string;
    rules: string[];
  }) => {
    await createMatch({
      creatorId: currentUser.id,
      stakeAmount: data.stakeAmount,
      gameMode: data.gameMode,
      map: data.map,
      rules: data.rules,
    });

    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
    setIsCreateBetOpen(false);
    setCreateBetInitialMode(undefined);
    setCreateBetInitialStake(undefined);
    navigate('/arena'); // Navigate immediately into active room view
  };

  const handleJoinMatch = async (matchId: string, opponentId: string) => {
    try {
      await joinMatch(matchId, opponentId);
      const updatedUser = await fetchUser(currentUser.id);
      setCurrentUser(updatedUser);
      await loadData();
      navigate('/arena');
    } catch (err: any) {
      alert(err.message || 'Failed to join match');
    }
  };

  const handleOpponentStake = async (
    matchId: string,
    paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance'
  ) => {
    await opponentStakeMatch(matchId, {
      opponentId: currentUser.id,
      paymentMethod,
    });
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleCreatorStake = async (
    matchId: string,
    paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance'
  ) => {
    await creatorStakeMatch(matchId, {
      creatorId: currentUser.id,
      paymentMethod,
    });
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleSimulateOpponentStake = async (matchId: string) => {
    await loadData();
  };

  const handleCompleteOnboarding = async (userData: {
    codmIgn: string;
    codmUid?: string;
    email: string;
    phone: string;
    initialDeposit?: number;
  }) => {
    const newUser = await createUser({
      ...userData,
      initialDeposit: userData.initialDeposit || 0,
    });

    setCurrentUser(newUser);
    localStorage.setItem('codm_current_user_id', newUser.id);
    await loadData();
    setOnboardingTargetMatch(null);
    navigate('/arena');
  };

  const handleSubmitResult = async (matchId: string, claim: 'VICTORY' | 'DEFEAT' | 'DRAW', screenshotBase64?: string) => {
    await submitMatchResult(matchId, {
      playerId: currentUser.id,
      claim,
      screenshotBase64,
    });
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleCancelMatch = async (matchId: string) => {
    await cancelMatch(matchId);
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleSignUp = async (data: {
    email: string;
    password: string;
    codmIgn: string;
    codmUid: string;
    initialDeposit: number;
  }) => {
    const user = await signUpUser(data);
    localStorage.setItem('codm_current_user_id', user.id);
    setCurrentUser(user);
    await loadData(user.id);
    navigate('/arena');
  };

  const handleSignIn = async (data: {
    identifier: string;
    password: string;
  }) => {
    const user = await signInUser(data);
    localStorage.setItem('codm_current_user_id', user.id);
    setCurrentUser(user);
    await loadData(user.id);
    navigate('/arena');
  };

  const handleSignOut = () => {
    localStorage.removeItem('codm_current_user_id');
    navigate('/auth');
  };

  const handleUpdateUser = async (updatedData: Partial<UserProfile>) => {
    try {
      const saved = await updateUser(currentUser.id, updatedData);
      setCurrentUser(saved);
    } catch (err) {
      const updated = { ...currentUser, ...updatedData };
      setCurrentUser(updated);
    }
  };

  const handleCashOut = async (amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string }) => {
    try {
      await withdrawWallet(currentUser.id, amount, bankDetails);
      const updatedUser = await fetchUser(currentUser.id);
      setCurrentUser(updatedUser);
      alert(`Successfully cashed out ₦${amount.toLocaleString()} to ${bankDetails.bankName} (${bankDetails.accountNumber})!`);
    } catch (err: any) {
      alert(err.message || 'Cash out failed');
    }
  };

  const handleNavigate = (tab: string) => {
    if (tab === 'landing') navigate('/');
    else navigate(`/${tab}`);
  };

  // 1. STANDALONE SEPARATED LANDING PAGE VIEW
  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-tactical-grid selection:bg-amber-500 selection:text-black">
        <LandingPage
          matches={matches}
          onOpenAuth={(mode) => {
            setAuthMode(mode || 'signup');
            navigate('/auth');
          }}
        />
      </div>
    );
  }

  // 2. AUTHENTICATION PAGE VIEW
  if (currentTab === 'auth') {
    return (
      <AuthPage
        initialMode={authMode}
        onSignUp={handleSignUp}
        onSignIn={handleSignIn}
        onBackToLanding={() => navigate('/')}
        demoUsers={{}}
      />
    );
  }

  // 3. IN-APP PAGES WITH ROUTING & NAVBAR / BOTTOM DOCK
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-tactical-grid selection:bg-amber-500 selection:text-black relative">
      <Navbar
        currentUser={currentUser}
        currentTab={currentTab}
        onNavigate={handleNavigate}
        openCreateBetModal={() => handleOpenCreateBet()}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28">
        <Routes>
          <Route
            path="/arena"
            element={
              <CoreArena
                currentUser={currentUser}
                matches={matches}
                onCreateBet={handleCreateBet}
                onJoinMatch={handleJoinMatch}
                onOpponentStake={handleOpponentStake}
                onCreatorStake={handleCreatorStake}
                onSimulateOpponentStake={handleSimulateOpponentStake}
                onSubmitResult={handleSubmitResult}
                onCancelMatch={handleCancelMatch}
                onCashOut={handleCashOut}
                onRefresh={loadData}
                onOpenCreateBet={handleOpenCreateBet}
                onOpenNewUserOnboarding={(targetMatch) => {
                  setOnboardingTargetMatch(targetMatch || null);
                  setIsOnboardingModalOpen(true);
                }}
              />
            }
          />
          <Route
            path="/rules"
            element={
              <RulesPage
                onOpenCreateBet={handleOpenCreateBet}
                onNavigateToArena={() => navigate('/arena')}
              />
            }
          />
          <Route
            path="/history"
            element={
              <HistoryPage
                currentUser={currentUser}
                matches={matches}
                onNavigateToArena={() => navigate('/arena')}
                onOpenCreateBet={handleOpenCreateBet}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <ProfilePage
                currentUser={currentUser}
                matches={matches}
                onUpdateUser={handleUpdateUser}
                onCashOut={handleCashOut}
                onNavigateToArena={() => navigate('/arena')}
                onNavigateToHistory={() => navigate('/history')}
                onNavigateToRules={() => navigate('/rules')}
                onOpenCreateBet={handleOpenCreateBet}
                onSignOut={handleSignOut}
              />
            }
          />
          <Route
            path="*"
            element={
              <CoreArena
                currentUser={currentUser}
                matches={matches}
                onCreateBet={handleCreateBet}
                onJoinMatch={handleJoinMatch}
                onOpponentStake={handleOpponentStake}
                onCreatorStake={handleCreatorStake}
                onSimulateOpponentStake={handleSimulateOpponentStake}
                onSubmitResult={handleSubmitResult}
                onCancelMatch={handleCancelMatch}
                onCashOut={handleCashOut}
                onRefresh={loadData}
                onOpenCreateBet={handleOpenCreateBet}
                onOpenNewUserOnboarding={(targetMatch) => {
                  setOnboardingTargetMatch(targetMatch || null);
                  setIsOnboardingModalOpen(true);
                }}
              />
            }
          />
        </Routes>
      </main>

      <BottomNavbar
        currentUser={currentUser}
        currentTab={currentTab}
        onNavigate={handleNavigate}
      />

      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-white tracking-wider">CODM STAKE</span>
            <span>·</span>
            <span>Call of Duty: Mobile Esports Escrow Wagering in Nigerian Naira (₦)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-neutral-400">Escrow Protected</span>
            <span>·</span>
            <span>Min Wager: ₦1,000</span>
            <span>·</span>
            <span>10% Platform Rake</span>
          </div>
        </div>
      </footer>

      <CreateBetModal
        currentUser={currentUser}
        isOpen={isCreateBetOpen}
        initialMode={createBetInitialMode}
        initialStake={createBetInitialStake}
        onClose={() => {
          setIsCreateBetOpen(false);
          setCreateBetInitialMode(undefined);
          setCreateBetInitialStake(undefined);
        }}
        onSubmit={handleCreateBet}
      />

      <OpponentOnboardingModal
        match={onboardingTargetMatch}
        isOpen={isOnboardingModalOpen}
        onClose={() => {
          setIsOnboardingModalOpen(false);
          setOnboardingTargetMatch(null);
        }}
        onCompleteOnboarding={handleCompleteOnboarding}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
