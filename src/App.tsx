import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Talk from './pages/Talk';
import LiveTalk from './pages/LiveTalk';
import TalkDetail from './pages/TalkDetail';
import BidHistory from './pages/BidHistory';
import MyPage from './pages/MyPage';
import Rankings from './pages/Rankings';
import HowItWorks from './pages/HowItWorks';
import InfluencerDashboard from './pages/InfluencerDashboard';
import InfluencerPage from './pages/InfluencerPage';
import FanProfile from './pages/FanProfile';
import CallPage from './pages/CallPage';
import { AuthProvider } from './contexts/AuthContext';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // ページ遷移時にスクロール位置をリセット
  useEffect(() => {
    window.scrollTo(0, 0);
    const rootElement = document.documentElement;
    rootElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  const handleNavigate = (page: string) => {
    navigate(`/${page === 'home' ? '' : page}`);
  };

  return (
    <Layout onNavigate={handleNavigate}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/i/:influencerId" element={<InfluencerPage />} />
        <Route path="/fan/:fanId" element={<FanProfile />} />
        <Route path="/talk" element={<Talk />} />
        <Route path="/talk/:talkId" element={<TalkDetail />} />
        <Route path="/live-talk/:talkId" element={<LiveTalk />} />
        <Route path="/bid-history/:talkId" element={<BidHistory />} />
        <Route path="/call/:purchasedSlotId" element={<CallPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/influencer-dashboard" element={<InfluencerDashboard />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;