import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  User as UserIcon, 
  Calendar, 
  Pen as EditIcon, 
  Video, 
  Crown,
  Award,
  Camera,
  Plus,
  X,
  Eye,
  EyeOff,
  Heart,
  DollarSign,
  Users,
  Sparkles,
  Shield,
  Lock,
  Globe,
  Save,
  Trash2
} from 'lucide-react';
import { Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  mockBadges, 
  mockActivityLogs, 
  mockCollections
} from '../data/mockData';
import { UserProfile, Badge as BadgeType } from '../types';
import { updateUserProfile, updateProfileImage } from '../api/user';
import { getUserStats, getFanPurchasedCalls, getFanBidHistory, getInfluencerEarnings } from '../api/userStats';
import { getUserBadges, getAvailableBadges } from '../api/userBadges';
import { getUserActivity } from '../api/userActivity';
import { getUserCollection, getInfluencerCollection } from '../api/userCollection';
import { validateImageFile, getImagePreviewUrl } from '../lib/storage';
import { createConnectAccount, getInfluencerStripeStatus, createOrResumeOnboarding } from '../api/stripe';
import { supabase } from '../lib/supabase';
import CreateCallSlotForm from '../components/CreateCallSlotForm';
import { InfluencerEarningsDashboard } from '../components/InfluencerEarningsDashboard';
import { getInfluencerCallSlots, deleteCallSlot, toggleCallSlotPublish } from '../api/callSlots';
import type { CallSlot } from '../lib/supabase';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { calculateOshiRank, calculatePoints } from '../data/mockData';
import { getUpcomingPurchasedTalks, getCompletedPurchasedTalks } from '../api/purchasedTalks';
import type { TalkSession } from '../types';

export default function MyPage() {
  const { user, supabaseUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'profile' | 'rank' | 'badges' | 'activity' | 'collection' | 'privacy'>('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState({
    total_spent: 0,
    total_calls_purchased: 0,
    total_bids: 0,
    total_earnings: 0,
    total_calls_completed: 0,
    average_rating: 0,
    oshi_tags: [] as string[],
    fan_tags: [] as string[],
  });
  const [newTag, setNewTag] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null);
  const [activityFilter, setActivityFilter] = useState<'all' | 'call' | 'bid' | 'event'>('all');
  const [activitySort, setActivitySort] = useState<'date' | 'type'>('date');
  
  // DBから取得するデータの状態
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [userCollection, setUserCollection] = useState<any[]>([]);
  const [availableBadges, setAvailableBadges] = useState<any[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  
  // インフルエンサーダッシュボード用の状態
  const [callSlots, setCallSlots] = useState<CallSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [talkSlotsTab, setTalkSlotsTab] = useState<'scheduled' | 'completed'>('scheduled');

  // ファン向け：落札済みTalk用の状態
  const [purchasedTalks, setPurchasedTalks] = useState<TalkSession[]>([]);
  const [isLoadingPurchasedTalks, setIsLoadingPurchasedTalks] = useState(false);
  const [purchasedTalksTab, setPurchasedTalksTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Talk枠編集用の状態
  const [editingCallSlot, setEditingCallSlot] = useState<CallSlot | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    scheduled_start_time: '',
    duration_minutes: 30,
    starting_price: 0,
    minimum_bid_increment: 0,
    buy_now_price: null as number | null,
    auction_end_time: '',
    thumbnail_url: undefined as string | undefined,
  });
  const [editHasBuyNowPrice, setEditHasBuyNowPrice] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [isTalkSlotsExpanded, setIsTalkSlotsExpanded] = useState(true); // アコーディオンの開閉状態

  // 編集用の状態
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');

  // ロール選択モーダル
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showInfluencerApplication, setShowInfluencerApplication] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // インフルエンサー申請フォーム
  const [applicationForm, setApplicationForm] = useState({
    realName: '',
    affiliation: '',
    snsLinks: ['']
  });
  
  // Stripe Connect関連の状態
  const [stripeAccountStatus, setStripeAccountStatus] = useState<string>('not_setup');
  const [isSettingUpStripe, setIsSettingUpStripe] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // 未ログインユーザーのリダイレクト
  useEffect(() => {
    if (!user || !supabaseUser) {
      navigate('/');
    }
  }, [user, supabaseUser, navigate]);

  // URLパラメータからタブを読み取る
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'rank', 'badges', 'activity', 'collection', 'privacy'].includes(tabParam)) {
      setActiveTab(tabParam as 'profile' | 'rank' | 'badges' | 'activity' | 'collection' | 'privacy');
    }
  }, [searchParams]);

  // 初回ユーザー検出ロジック
  useEffect(() => {
    if (supabaseUser) {
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_${supabaseUser.id}`);

      // オンボーディングが完了していない かつ インフルエンサーでもない場合
      if (!hasCompletedOnboarding && !supabaseUser.is_influencer) {
        setShowRoleSelection(true);
      }
    }
  }, [supabaseUser]);

  // 実際のユーザーデータをロード
  useEffect(() => {
    if (supabaseUser) {
      setEditedDisplayName(supabaseUser.display_name);
      setEditedBio(supabaseUser.bio || '');
      setImagePreview(supabaseUser.profile_image_url || '');

      // ユーザー統計を取得
      loadUserStats();

      // バッジ、活動ログ、コレクションを取得
      loadUserData();

      // インフルエンサーの場合、Stripe Connect状態を確認
      if (supabaseUser.is_influencer) {
        checkStripeAccountStatus();
        loadCallSlots();
      } else {
        // ファンの場合、落札済みTalkを読み込む
        loadPurchasedTalks();
      }
    }
  }, [supabaseUser]);

  // ユーザー統計を取得
  const loadUserStats = async () => {
    if (!supabaseUser) return;
    
    try {
      const stats = await getUserStats(supabaseUser.id);
      setUserStats(stats);
      
      // プロフィール情報を構築
      const userProfile: UserProfile = {
        id: supabaseUser.id,
        username: supabaseUser.username || '',
        email: supabaseUser.email || '',
        avatar_url: supabaseUser.profile_image_url || '',
        nickname: supabaseUser.display_name || '',
        bio: supabaseUser.bio || '',
        oshi_tags: stats.oshi_tags,
        fan_tags: stats.fan_tags,
        total_spent: stats.total_spent,
        successful_bids: stats.total_bids,
        created_at: supabaseUser.created_at || '',
        oshi_rank: calculateOshiRank(stats.total_spent, stats.total_calls_purchased, stats.total_bids),
        total_points: calculatePoints(stats.total_calls_purchased, 0, stats.total_bids, 0),
        call_count: stats.total_calls_purchased,
        call_minutes: stats.total_calls_purchased * 30, // 仮の計算
        bid_count: stats.total_bids,
        event_count: 0,
        badges: [],
        privacy_settings: {
          profile_visibility: 'public',
          call_history_visibility: 'public',
          influencer_visibility: {}
        }
      };
      
      setProfile(userProfile);
    } catch (error) {
      console.error('ユーザー統計取得エラー:', error);
      // エラーの場合は空のプロフィールを設定
      setProfile({
        id: supabaseUser.id,
        username: supabaseUser.username || '',
        email: supabaseUser.email || '',
        avatar_url: supabaseUser.profile_image_url || '',
        nickname: supabaseUser.display_name || '',
        bio: supabaseUser.bio || '',
        oshi_tags: [],
        fan_tags: [],
        total_spent: 0,
        successful_bids: 0,
        created_at: supabaseUser.created_at || '',
        oshi_rank: {
          level: 'Newbie',
          points: 0,
          title: '初心者ファン',
          description: '初心者ファン',
          color: 'green'
        },
        total_points: 0,
        call_count: 0,
        call_minutes: 0,
        bid_count: 0,
        event_count: 0,
        badges: [],
        privacy_settings: {
          profile_visibility: 'public',
          call_history_visibility: 'public',
          influencer_visibility: {}
        }
      });
    }
  };

  // ユーザーデータ（バッジ、活動ログ、コレクション）を取得
  const loadUserData = async () => {
    if (!supabaseUser) return;
    
    try {
      // バッジを取得
      setIsLoadingBadges(true);
      const badges = await getUserBadges(supabaseUser.id);
      setUserBadges(badges);
      
      // 利用可能なバッジを取得
      const available = await getAvailableBadges();
      setAvailableBadges(available);
      
      // 活動ログを取得
      setIsLoadingActivity(true);
      const activity = await getUserActivity(supabaseUser.id);
      setUserActivity(activity);
      
      // コレクションを取得
      setIsLoadingCollection(true);
      if (supabaseUser.is_influencer) {
        const collection = await getInfluencerCollection(supabaseUser.id);
        setUserCollection(collection);
      } else {
        const collection = await getUserCollection(supabaseUser.id);
        setUserCollection(collection);
      }
    } catch (error) {
      console.error('ユーザーデータ取得エラー:', error);
    } finally {
      setIsLoadingBadges(false);
      setIsLoadingActivity(false);
      setIsLoadingCollection(false);
    }
  };

  // Stripe Connect アカウント状態を確認
  const checkStripeAccountStatus = async () => {
    if (!supabaseUser) return;
    
    console.log('🔍 Stripe状態確認開始:', {
      supabaseUserId: supabaseUser.id,
      authUserId: supabaseUser.auth_user_id,
      isInfluencer: supabaseUser.is_influencer
    });
    
    try {
      // auth_user_idを使用してAPIを呼び出し
      const userId = supabaseUser.auth_user_id || supabaseUser.id;
      console.log('🔍 使用するユーザーID:', userId);
      
      const status = await getInfluencerStripeStatus(userId);
      console.log('✅ Stripe状態取得成功:', status);
      setStripeAccountStatus(status.accountStatus || 'not_setup');
    } catch (error) {
      console.error('Stripe アカウント状態の確認エラー:', error);
      setStripeAccountStatus('not_setup');
    }
  };

  // Stripe Connect オンボーディング開始/再開（途中離脱対応）
  const handleSetupStripeConnect = async () => {
    if (!supabaseUser) return;

    console.log('🔍 オンボーディング開始/再開:', {
      id: supabaseUser.id,
      auth_user_id: supabaseUser.auth_user_id,
    });

    // auth_user_id を使って Supabase Auth から実際のユーザー情報を取得
    let userEmail = '';
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user) {
        userEmail = authUser.user.email || '';
      }
    } catch (error) {
      console.error('Auth ユーザー情報取得エラー:', error);
    }

    if (!userEmail) {
      setStripeError('メールアドレスが取得できませんでした。メールアドレスを手動で入力してください。');
      setShowEmailInput(true);
      return;
    }

    setIsSettingUpStripe(true);
    setStripeError('');

    try {
      const userId = supabaseUser.auth_user_id || supabaseUser.id;
      console.log('🔍 オンボーディング作成/再開:', { userEmail, userId });

      // 新しいAPI（途中離脱対応）を呼び出し
      const result = await createOrResumeOnboarding(userId, userEmail);

      if (result.status === 'complete') {
        // 既に完了済み - Dashboardを開く
        console.log('✅ アカウント設定完了済み - Dashboard表示');
        window.open(result.dashboardUrl, '_blank');
        // ステータスを更新
        await checkStripeAccountStatus();
      } else {
        // 未完了 - オンボーディングへ遷移
        console.log('🔵 オンボーディングへ遷移:', result.status);
        window.location.href = result.onboardingUrl;
      }
    } catch (error: any) {
      console.error('Stripe Connect 設定エラー:', error);
      setStripeError(error.message || 'Stripe Connect の設定に失敗しました');
    } finally {
      setIsSettingUpStripe(false);
    }
  };

  // メールアドレス手動入力でのStripe Connect設定
  const handleSetupStripeConnectWithEmail = async () => {
    if (!emailInput.trim()) {
      setStripeError('メールアドレスを入力してください');
      return;
    }

    if (!supabaseUser) return;

    setIsSettingUpStripe(true);
    setStripeError('');

    try {
      const userId = supabaseUser.auth_user_id || supabaseUser.id;
      console.log('🔍 オンボーディング作成/再開（手動）:', { email: emailInput.trim(), userId });

      // 新しいAPI（途中離脱対応）を呼び出し
      const result = await createOrResumeOnboarding(userId, emailInput.trim());

      if (result.status === 'complete') {
        // 既に完了済み - Dashboardを開く
        console.log('✅ アカウント設定完了済み - Dashboard表示');
        window.open(result.dashboardUrl, '_blank');
        await checkStripeAccountStatus();
      } else {
        // 未完了 - オンボーディングへ遷移
        console.log('🔵 オンボーディングへ遷移:', result.status);
        window.location.href = result.onboardingUrl;
      }
    } catch (error: any) {
      console.error('Stripe Connect 設定エラー:', error);
      setStripeError(error.message || 'Stripe Connect の設定に失敗しました');
    } finally {
      setIsSettingUpStripe(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ja-JP').format(price);
  };

  // 落札済みTalkをフィルタリング
  const upcomingPurchasedTalks = purchasedTalks.filter(talk => talk.status === 'won');
  const completedPurchasedTalks = purchasedTalks.filter(talk => talk.status === 'completed');

  // ファン向け：落札済みTalkを読み込む
  const loadPurchasedTalks = async () => {
    if (!supabaseUser || supabaseUser.is_influencer) return;

    try {
      setIsLoadingPurchasedTalks(true);
      const [upcoming, completed] = await Promise.all([
        getUpcomingPurchasedTalks(supabaseUser.id),
        getCompletedPurchasedTalks(supabaseUser.id)
      ]);

      // 両方を結合して保存
      setPurchasedTalks([...upcoming, ...completed]);
      console.log('📚 落札済みTalk:', { upcoming: upcoming.length, completed: completed.length });
    } catch (err) {
      console.error('落札済みTalk取得エラー:', err);
    } finally {
      setIsLoadingPurchasedTalks(false);
    }
  };

  // インフルエンサーダッシュボード用の関数
  const loadCallSlots = async () => {
    if (!supabaseUser?.is_influencer) return;

    try {
      setIsLoadingSlots(true);
      setDashboardError('');
      const slots = await getInfluencerCallSlots(supabaseUser.id);
      setCallSlots(slots);
    } catch (err) {
      console.error('Talk枠取得エラー:', err);
      setDashboardError('Talk枠の取得に失敗しました');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadCallSlots();
  };

  const handleDelete = async (callSlotId: string) => {
    if (!confirm('このTalk枠を削除してもよろしいですか？')) return;

    try {
      await deleteCallSlot(callSlotId);
      loadCallSlots();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('Talk枠の削除に失敗しました');
    }
  };

  const handleTogglePublish = async (callSlotId: string, currentStatus: boolean) => {
    try {
      await toggleCallSlotPublish(callSlotId, !currentStatus);
      loadCallSlots();
    } catch (err) {
      console.error('公開状態変更エラー:', err);
      alert('公開状態の変更に失敗しました');
    }
  };

  const handleEditCallSlot = (slot: CallSlot) => {
    setEditingCallSlot(slot);
    setEditForm({
      title: slot.title,
      description: slot.description || '',
      scheduled_start_time: slot.scheduled_start_time.slice(0, 16), // datetime-local形式に変換
      duration_minutes: slot.duration_minutes,
      starting_price: slot.starting_price,
      minimum_bid_increment: slot.minimum_bid_increment,
      buy_now_price: slot.buy_now_price,
      auction_end_time: slot.auction_end_time?.slice(0, 16) || '',
      thumbnail_url: slot.thumbnail_url || undefined,
    });
    setEditHasBuyNowPrice(slot.buy_now_price !== null && slot.buy_now_price !== undefined);
    setEditImageFile(null);
    setEditImagePreview(slot.thumbnail_url || '');
  };

  const handleSaveCallSlot = async () => {
    if (!editingCallSlot) return;

    try {
      setSaving(true);

      // 画像をアップロード（新しい画像が選択されている場合）
      let thumbnailUrl = editForm.thumbnail_url;
      if (editImageFile) {
        try {
          setUploadingEditImage(true);
          const { uploadImage } = await import('../lib/storage');
          thumbnailUrl = await uploadImage(editImageFile, 'talk-images', 'thumbnails');
          console.log('✅ 画像アップロード成功:', thumbnailUrl);
        } catch (uploadError: any) {
          console.error('画像アップロードエラー:', uploadError);
          alert(`画像のアップロードに失敗しました: ${uploadError.message}`);
          setSaving(false);
          setUploadingEditImage(false);
          return;
        } finally {
          setUploadingEditImage(false);
        }
      }

      // Call Slotを更新
      const { updateCallSlot } = await import('../api/callSlots');
      await updateCallSlot(editingCallSlot.id, {
        title: editForm.title,
        description: editForm.description,
        scheduled_start_time: editForm.scheduled_start_time,
        duration_minutes: editForm.duration_minutes,
        starting_price: editForm.starting_price,
        minimum_bid_increment: editForm.minimum_bid_increment,
        buy_now_price: editHasBuyNowPrice ? editForm.buy_now_price : null,
        thumbnail_url: thumbnailUrl,
      });

      // オークション終了時間を更新（変更されている場合）
      if (editForm.auction_end_time && editForm.auction_end_time !== editingCallSlot.auction_end_time?.slice(0, 16)) {
        const { supabase } = await import('../lib/supabase');
        if (editingCallSlot.auction_id) {
          const { error } = await supabase.rpc('update_auction_end_time', {
            p_auction_id: editingCallSlot.auction_id,
            p_new_end_time: editForm.auction_end_time
          });
          if (error) throw error;
        }
      }

      setSuccessMessage('Talk枠を更新しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadCallSlots();
      setEditingCallSlot(null);
    } catch (error) {
      console.error('Talk枠更新エラー:', error);
      setError('Talk枠の更新に失敗しました');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditCallSlot = () => {
    setEditingCallSlot(null);
  };

  // Talk枠の分類
  const scheduledSlots = callSlots.filter(slot => {
    const now = new Date();
    const slotDate = new Date(slot.scheduled_start_time);
    return slotDate > now;
  });

  const completedSlots = callSlots.filter(slot => {
    const now = new Date();
    const slotDate = new Date(slot.scheduled_start_time);
    return slotDate <= now;
  });

  // ステータス表示用の関数
  const getSlotStatus = (slot: CallSlot) => {
    const now = new Date();
    const slotDate = new Date(slot.scheduled_start_time);
    const endDate = new Date(slotDate.getTime() + slot.duration_minutes * 60000);
    
    if (slotDate > now) {
      return { text: '予定', color: 'bg-blue-100 text-blue-700', icon: '📅' };
    } else if (now >= slotDate && now <= endDate) {
      return { text: '実施中', color: 'bg-green-100 text-green-700', icon: '🔴' };
    } else {
      return { text: '終了', color: 'bg-gray-100 text-gray-700', icon: '✅' };
    }
  };

  const getRankColor = (color: string) => {
    switch (color) {
      case 'yellow': return 'from-yellow-400 to-amber-500';
      case 'purple': return 'from-purple-500 to-indigo-600';
      case 'blue': return 'from-blue-500 to-cyan-600';
      case 'green': return 'from-green-500 to-emerald-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getBadgeRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50';
      case 'epic': return 'border-purple-400 bg-gradient-to-r from-purple-50 to-indigo-50';
      case 'rare': return 'border-blue-400 bg-gradient-to-r from-blue-50 to-cyan-50';
      case 'common': return 'border-gray-400 bg-gradient-to-r from-gray-50 to-gray-100';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  // プロフィール保存処理（表示名・自己紹介のみ）
  const handleSaveProfile = async () => {
    if (!supabaseUser) return;
    
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');
      
      // 表示名のバリデーション
      if (!editedDisplayName.trim()) {
        setError('表示名を入力してください');
        setSaving(false);
        return;
      }
      
      // プロフィール情報を更新（画像は自動保存されるため除外）
      await updateUserProfile(supabaseUser.id, {
        display_name: editedDisplayName.trim(),
        bio: editedBio.trim(),
      });
      
      // ユーザー情報を再取得
      await refreshUser();
      
      setIsEditingProfile(false);
      setSuccessMessage('プロフィールを更新しました！');
      
      // 3秒後に成功メッセージを消す
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err: any) {
      console.error('プロフィール保存エラー:', err);
      setError(err.message || 'プロフィールの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // プロフィール画像の変更（自動保存）
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabaseUser) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || '画像ファイルが無効です');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');
      
      // プレビュー生成
      const preview = await getImagePreviewUrl(file);
      setImagePreview(preview);
      
      // 画像をアップロード
      await updateProfileImage(supabaseUser.id, file);
      
      // ユーザー情報を再取得
      await refreshUser();
      
      setSuccessMessage('プロフィール画像を更新しました！');
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err: any) {
      console.error('画像アップロードエラー:', err);
      setError(err.message || 'プロフィール画像のアップロードに失敗しました');
      setTimeout(() => setError(''), 3000);
      // エラー時は元の画像に戻す
      setImagePreview(supabaseUser.profile_image_url || '');
    } finally {
      setSaving(false);
    }
  };

  // ロール選択ハンドラー
  const handleRoleSelection = async (role: 'fan' | 'influencer') => {
    if (!supabaseUser) return;

    try {
      if (role === 'fan') {
        // ファンとして続行
        localStorage.setItem(`onboarding_${supabaseUser.id}`, 'fan');
        setShowRoleSelection(false);
      } else {
        // インフルエンサー申請フォームを表示
        setShowRoleSelection(false);
        setShowInfluencerApplication(true);
      }
    } catch (err: any) {
      console.error('ロール選択エラー:', err);
      alert('エラーが発生しました。もう一度お試しください。');
    }
  };

  // インフルエンサー申請送信
  const handleInfluencerApplicationSubmit = async () => {
    if (!supabaseUser) return;

    // バリデーション
    if (!applicationForm.realName.trim()) {
      alert('お名前を入力してください。');
      return;
    }

    if (!applicationForm.affiliation.trim()) {
      alert('所属を入力してください。');
      return;
    }

    const validSnsLinks = applicationForm.snsLinks.filter(link => link.trim());
    if (validSnsLinks.length === 0) {
      alert('少なくとも1つのSNSアカウントを入力してください。');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // データベースに申請情報を保存
      const { error: dbError } = await supabase
        .from('users')
        .update({
          bio: `${applicationForm.realName} | ${applicationForm.affiliation}`
        })
        .eq('id', supabaseUser.id);

      if (dbError) throw dbError;

      // バックエンドにメール送信リクエスト
      const requestData = {
        userId: supabaseUser.id,
        displayName: supabaseUser.display_name,
        email: supabaseUser.email,
        realName: applicationForm.realName,
        affiliation: applicationForm.affiliation,
        snsLinks: validSnsLinks
      };

      console.log('=== フロントエンド送信データ ===');
      console.log('Request URL:', `${import.meta.env.VITE_BACKEND_URL || ''}/api/send-influencer-application`);
      console.log('Request data:', requestData);

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/send-influencer-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        throw new Error('メール送信に失敗しました');
      }

      localStorage.setItem(`onboarding_${supabaseUser.id}`, 'influencer_pending');
      setShowInfluencerApplication(false);
      alert('インフルエンサー申請を受け付けました。審査後にご連絡いたします。\n通常、1〜3営業日以内に審査結果をメールでお知らせします。');

      // フォームをリセット
      setApplicationForm({
        realName: '',
        affiliation: '',
        snsLinks: ['']
      });
    } catch (err: any) {
      console.error('インフルエンサー申請エラー:', err);
      setError(err.message || 'エラーが発生しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  // SNSリンク追加
  const addSnsLink = () => {
    if (applicationForm.snsLinks.length < 5) {
      setApplicationForm({
        ...applicationForm,
        snsLinks: [...applicationForm.snsLinks, '']
      });
    }
  };

  // SNSリンク削除
  const removeSnsLink = (index: number) => {
    setApplicationForm({
      ...applicationForm,
      snsLinks: applicationForm.snsLinks.filter((_, i) => i !== index)
    });
  };

  // SNSリンク更新
  const updateSnsLink = (index: number, value: string) => {
    const newLinks = [...applicationForm.snsLinks];
    newLinks[index] = value;
    setApplicationForm({
      ...applicationForm,
      snsLinks: newLinks
    });
  };

  const addTag = (type: 'oshi' | 'fan') => {
    if (newTag.trim() && profile && !profile[`${type}_tags`].includes(newTag.trim())) {
      setProfile({
        ...profile,
        [`${type}_tags`]: [...profile[`${type}_tags`], newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (type: 'oshi' | 'fan', index: number) => {
    if (profile) {
      setProfile({
        ...profile,
        [`${type}_tags`]: profile[`${type}_tags`].filter((_, i) => i !== index)
      });
    }
  };

  const filteredActivities = userActivity
    .filter(activity => activityFilter === 'all' || activity.type === activityFilter)
    .sort((a, b) => activitySort === 'date' 
      ? new Date(b.date).getTime() - new Date(a.date).getTime()
      : a.type.localeCompare(b.type)
    );

  const tabs = [
    { id: 'profile', label: 'プロフィール', icon: UserIcon },
    { id: 'rank', label: 'ランク・ステータス', icon: Crown },
    { id: 'badges', label: '実績バッジ', icon: Award },
    { id: 'activity', label: '活動ログ', icon: Calendar },
    { id: 'collection', label: 'コレクション', icon: Heart },
    // プライバシー設定はインフルエンサーのみ
    ...(supabaseUser?.is_influencer ? [{ id: 'privacy', label: 'プライバシー', icon: Shield }] : []),
  ];

  return (
    <div className="bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100 min-h-screen">
      {/* Role Selection Modal - First Time User */}
      {showRoleSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              OshiTalkへようこそ！
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              あなたの利用方法を選択してください
            </p>

            <div className="space-y-4">
              {/* Fan Option */}
              <button
                onClick={() => handleRoleSelection('fan')}
                className="w-full p-6 border-2 border-pink-300 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all"
              >
                <div className="text-4xl mb-2">💕</div>
                <h3 className="font-bold text-gray-900 mb-2">ファンとして参加</h3>
                <p className="text-sm text-gray-600">
                  推しのTalk枠に入札して、通話を楽しみたい
                </p>
              </button>

              {/* Influencer Option */}
              <button
                onClick={() => handleRoleSelection('influencer')}
                className="w-full p-6 border-2 border-purple-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all"
              >
                <div className="text-4xl mb-2">✨</div>
                <h3 className="font-bold text-gray-900 mb-2">Talk枠を作成したい</h3>
                <p className="text-sm text-gray-600">
                  自分のTalk枠を作成して、ファンと通話したい
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Influencer Application Modal */}
      {showInfluencerApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              インフルエンサー申請
            </h2>
            <p className="text-gray-600 mb-6 text-center text-sm">
              以下の情報を入力してください。審査後、1〜3営業日以内にご連絡いたします。
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* お名前 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={applicationForm.realName}
                  onChange={(e) => setApplicationForm({ ...applicationForm, realName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="山田 太郎"
                  disabled={saving}
                />
              </div>

              {/* 所属 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  所属 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={applicationForm.affiliation}
                  onChange={(e) => setApplicationForm({ ...applicationForm, affiliation: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="フリーランス、所属事務所名など"
                  disabled={saving}
                />
              </div>

              {/* SNSアカウントリンク */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SNSアカウントリンク <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Instagram、X（Twitter）、TikTokなどのアカウントURLを入力してください
                </p>
                {applicationForm.snsLinks.map((link, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateSnsLink(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://instagram.com/yourname"
                      disabled={saving}
                    />
                    {applicationForm.snsLinks.length > 1 && (
                      <button
                        onClick={() => removeSnsLink(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        disabled={saving}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                {applicationForm.snsLinks.length < 5 && (
                  <button
                    onClick={addSnsLink}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                    disabled={saving}
                  >
                    <Plus className="h-4 w-4" />
                    <span>SNSリンクを追加</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => {
                  setShowInfluencerApplication(false);
                  setShowRoleSelection(true);
                  setApplicationForm({ realName: '', affiliation: '', snsLinks: [''] });
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                disabled={saving}
              >
                戻る
              </button>
              <button
                onClick={handleInfluencerApplicationSubmit}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '送信中...' : '申請を送信'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header - スッキリ版 */}
      <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200">
        <div className="flex items-center space-x-4 p-6">
          <div className="relative group flex-shrink-0">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
              <img
                src={imagePreview || profile?.avatar_url || '/images/default-avatar.png'}
                alt={supabaseUser?.display_name || profile?.nickname || profile?.username || 'ユーザー'}
                className="h-full w-full object-cover"
              />
            </div>
            {(
              <label className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1.5 rounded-full hover:bg-blue-600 transition-colors cursor-pointer shadow-md">
                <Camera className="h-3 w-3" />
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
            {supabaseUser?.is_influencer && (
              <div className="absolute -top-1 -right-1 bg-purple-500 text-white px-2 py-1 text-xs font-bold rounded-full shadow-md">
                ✨
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editedDisplayName}
                  onChange={(e) => setEditedDisplayName(e.target.value)}
                  className="text-lg font-bold text-pink-500 border-b border-pink-300 focus:border-pink-500 focus:outline-none px-1 flex-1 min-w-0"
                  placeholder="表示名"
                  maxLength={100}
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-800 truncate">
                  {supabaseUser?.display_name || profile?.nickname || profile?.username || 'ユーザー'}
                </h1>
              )}
              {(
                <>
                  {isEditingProfile ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="bg-green-500 text-white px-4 py-2 text-sm rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm"
                      >
                        <Save className="h-3 w-3" />
                        <span>{saving ? '保存中...' : '保存'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingProfile(false);
                          if (supabaseUser) {
                            setEditedDisplayName(supabaseUser.display_name);
                            setEditedBio(supabaseUser.bio || '');
                            setImagePreview(supabaseUser.profile_image_url || '');
                          }
                          setError('');
                        }}
                        disabled={saving}
                        className="bg-gray-500 text-white px-4 py-2 text-sm rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="bg-blue-500 text-white px-4 py-2 text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2 shadow-sm"
                    >
                      <EditIcon className="h-3 w-3" />
                      <span>編集</span>
                    </button>
                  )}
                </>
              )}
            </div>
            
            {user?.email && (
              <p className="text-xs text-gray-600 truncate">{user.email}</p>
            )}

            {/* ロール切り替えボタン */}
            <div className="mt-3">
              <button
                onClick={() => setShowRoleSelection(true)}
                className="inline-flex items-center space-x-2 px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-medium rounded-full hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-sm"
              >
                <Sparkles className="h-3 w-3" />
                <span>利用タイプを変更</span>
              </button>
            </div>

            {/* 統計情報 - スッキリ版 */}
            {(
              <div className="flex space-x-8 mt-4">
                {supabaseUser?.is_influencer ? (
                  <>
                    <div className="text-center">
                      <div className="text-sm font-bold text-green-600">¥{formatPrice(supabaseUser.total_earnings)}</div>
                      <div className="text-xs text-gray-600">収益</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-blue-600">{supabaseUser.total_calls_completed}</div>
                      <div className="text-xs text-gray-600">通話</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-purple-600">{supabaseUser.average_rating?.toFixed(1) || '-'}</div>
                      <div className="text-xs text-gray-600">評価</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-sm font-bold text-pink-600">¥{formatPrice((supabaseUser?.total_spent || profile?.total_spent || 0))}</div>
                      <div className="text-xs text-gray-600">支払い</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-green-600">{supabaseUser?.total_calls_purchased || profile?.call_count || 0}</div>
                      <div className="text-xs text-gray-600">通話</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-purple-600">{profile?.total_points || 0}</div>
                      <div className="text-xs text-gray-600">ポイント</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* メッセージ表示 */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 text-xs">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        {successMessage && (
          <div className="mt-3 p-2 bg-green-50 text-xs">
            <p className="text-green-600">✓ {successMessage}</p>
          </div>
        )}
      </div>

      {/* Talk枠管理 - スッキリ版 */}
      {supabaseUser?.is_influencer && (
        <>
          {/* Stripe Connect設定セクション（未完了の場合のみ表示） */}
          {stripeAccountStatus !== 'active' && (
            <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">💳 銀行口座設定</h3>

              {stripeAccountStatus === 'not_setup' && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-3">
                    売上を受け取るには銀行口座の登録が必要です
                  </p>
                  <button
                    onClick={handleSetupStripeConnect}
                    disabled={isSettingUpStripe}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {isSettingUpStripe ? '設定中...' : '銀行口座を登録する'}
                  </button>
                  {stripeError && (
                    <p className="mt-2 text-sm text-red-600">{stripeError}</p>
                  )}
                </div>
              )}

              {stripeAccountStatus === 'incomplete' && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-blue-800 mb-3">
                    銀行口座の登録が完了していません。登録を再開してください
                  </p>
                  <button
                    onClick={handleSetupStripeConnect}
                    disabled={isSettingUpStripe}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isSettingUpStripe ? '設定中...' : '登録を完了する'}
                  </button>
                </div>
              )}

              {stripeAccountStatus === 'pending' && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <p className="text-sm text-orange-800">
                    審査中です（通常1-2営業日）
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 売上ダッシュボード（完了済みの場合のみ表示） */}
          {stripeAccountStatus === 'active' && (
            <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200 p-6">
              <InfluencerEarningsDashboard authUserId={supabaseUser.auth_user_id || supabaseUser.id} />
            </div>
          )}

          {/* Talk枠セクション */}
          <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200">
            <div
              className="flex justify-between items-center p-6 border-b border-gray-200 cursor-pointer hover:bg-white/10 transition"
              onClick={() => setIsTalkSlotsExpanded(!isTalkSlotsExpanded)}
            >
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-800">Talk枠</h3>
                <span className="text-sm text-gray-500">
                  {isTalkSlotsExpanded ? '▼' : '▶'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // 親のクリックイベントを防ぐ
                  setShowCreateForm(true);
                }}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>新規作成</span>
              </button>
            </div>

          {/* コンテンツ（開いている時のみ表示） */}
          {isTalkSlotsExpanded && (
            <>
          {/* エラー表示 */}
          {dashboardError && (
            <div className="bg-red-50 p-2 mx-4">
              <p className="text-xs text-red-600">{dashboardError}</p>
            </div>
          )}

          {/* Talk枠タブ */}
          <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b border-gray-200">
            <div className="flex border border-gray-300 rounded-lg mx-6 my-4 overflow-hidden">
              <button
                onClick={() => setTalkSlotsTab('scheduled')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors border-r border-gray-300 ${
                  talkSlotsTab === 'scheduled'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                予定 ({scheduledSlots.length})
              </button>
              <button
                onClick={() => setTalkSlotsTab('completed')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  talkSlotsTab === 'completed'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                履歴 ({completedSlots.length})
              </button>
            </div>

            <div>
              {isLoadingSlots ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 h-16"></div>
                  ))}
                </div>
              ) : (talkSlotsTab === 'scheduled' ? scheduledSlots : completedSlots).length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-600 text-sm">
                    {talkSlotsTab === 'scheduled' ? '予定のTalk枠がありません' : '完了したTalk枠がありません'}
                  </p>
                  {talkSlotsTab === 'scheduled' && (
                    <p className="text-xs text-gray-500 mt-1">
                      「新規作成」ボタンから作成できます
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {(talkSlotsTab === 'scheduled' ? scheduledSlots : completedSlots).map((slot) => {
                    const status = getSlotStatus(slot);
                    return (
                      <div
                        key={slot.id}
                        className="border-b-2 border-blue-200 p-4 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h5 className="text-sm font-bold text-gray-900 truncate">{slot.title}</h5>
                              <span className={`px-2 py-1 text-xs font-medium ${status.color}`}>
                                {status.icon} {status.text}
                              </span>
                              {slot.is_published && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs flex-shrink-0">
                                  公開中
                                </span>
                              )}
                            </div>

                            {/* 予定日時を目立たせる */}
                            <div className="bg-blue-50 p-2 mb-2">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-bold text-blue-800">
                                  {format(new Date(slot.scheduled_start_time), 'yyyy年MM月dd日 HH:mm', {
                                    locale: ja,
                                  })}
                                </span>
                                <span className="text-xs text-blue-600">
                                  ({slot.duration_minutes}分間)
                                </span>
                              </div>
                            </div>

                            {/* オークション終了時間 */}
                            <div className="bg-orange-50 p-2 mb-2">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-orange-600" />
                                <span className="text-sm font-bold text-orange-800">
                                  {slot.auction_end_time ? (
                                    <>オークション終了: {format(new Date(slot.auction_end_time), 'yyyy年MM月dd日 HH:mm', {
                                      locale: ja,
                                    })}</>
                                  ) : (
                                    <>オークション終了時間: 未設定</>
                                  )}
                                </span>
                              </div>
                            </div>

                            {slot.description && (
                              <p className="text-xs text-gray-600 mb-2 line-clamp-2">{slot.description}</p>
                            )}

                            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                              <div className="flex items-center space-x-1">
                                <DollarSign className="h-3 w-3" />
                                <span>¥{slot.starting_price.toLocaleString()}</span>
                              </div>

                              <div className="text-gray-600">
                                <span className="text-xs">最小: ¥{slot.minimum_bid_increment}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex space-x-1 ml-2 flex-shrink-0">
                            {talkSlotsTab === 'scheduled' && (
                              <button
                                onClick={() => handleEditCallSlot(slot)}
                                className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Talk枠を編集"
                              >
                                <EditIcon className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {talkSlotsTab === 'scheduled' && (
                              <button
                                onClick={() => handleTogglePublish(slot.id, slot.is_published)}
                                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title={slot.is_published ? '非公開にする' : '公開する'}
                              >
                                {slot.is_published ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </button>
                            )}

                            {talkSlotsTab === 'scheduled' && (
                              <button
                                onClick={() => handleDelete(slot.id)}
                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="削除"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 統計情報 - フラット版 */}
          <div className="grid grid-cols-4">
            <div className="p-3 text-center border-r-2 border-blue-200">
              <div className="text-xs text-gray-600">総収益</div>
              <div className="text-sm font-bold text-green-600">
                ¥{supabaseUser.total_earnings.toLocaleString()}
              </div>
            </div>

            <div className="p-3 text-center border-r-2 border-blue-200">
              <div className="text-xs text-gray-600">通話数</div>
              <div className="text-sm font-bold text-blue-600">
                {supabaseUser.total_calls_completed}
              </div>
            </div>

            <div className="p-3 text-center border-r-2 border-blue-200">
              <div className="text-xs text-gray-600">評価</div>
              <div className="text-sm font-bold text-purple-600">
                {supabaseUser.average_rating?.toFixed(1) || '-'}
              </div>
            </div>

            <div className="p-3 text-center">
              <div className="text-xs text-gray-600">枠数</div>
              <div className="text-sm font-bold text-pink-600">
                {callSlots.length}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
        </>
      )}

      {/* ファン向け：落札済みTalk枠セクション */}
      {supabaseUser && !supabaseUser.is_influencer && (
        <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-800">落札済みTalk</h3>
          </div>

          {/* Talk枠タブ */}
          <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b border-gray-200">
            <div className="flex border border-gray-300 rounded-lg mx-6 my-4 overflow-hidden">
              <button
                onClick={() => setPurchasedTalksTab('upcoming')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors border-r border-gray-300 ${
                  purchasedTalksTab === 'upcoming'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                予定 ({upcomingPurchasedTalks.length})
              </button>
              <button
                onClick={() => setPurchasedTalksTab('completed')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  purchasedTalksTab === 'completed'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                履歴 ({completedPurchasedTalks.length})
              </button>
            </div>

            <div>
              {isLoadingPurchasedTalks ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-100 h-16"></div>
                  ))}
                </div>
              ) : (purchasedTalksTab === 'upcoming' ? upcomingPurchasedTalks : completedPurchasedTalks).length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-600 text-sm">
                    {purchasedTalksTab === 'upcoming' ? '予定のTalkがありません' : '完了したTalkがありません'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {(purchasedTalksTab === 'upcoming' ? upcomingPurchasedTalks : completedPurchasedTalks).map((talk) => {
                    return (
                      <div
                        key={talk.id}
                        className="border-b-2 border-blue-200 p-4 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => navigate(`/talk/${talk.id}`)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h5 className="text-sm font-bold text-gray-900 truncate">{talk.title}</h5>
                              <span className={`px-2 py-1 text-xs font-medium ${
                                talk.status === 'won' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {talk.status === 'won' ? '✓ 予定' : '✓ 完了'}
                              </span>
                            </div>

                            {/* 予定日時 */}
                            <div className="bg-blue-50 p-2 mb-2">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-bold text-blue-800">
                                  {format(new Date(talk.start_time), 'yyyy年MM月dd日 HH:mm', { locale: ja })}
                                </span>
                              </div>
                            </div>

                            {/* インフルエンサー情報 */}
                            <div className="flex items-center space-x-2">
                              <img
                                src={talk.influencer.avatar_url}
                                alt={talk.influencer.name}
                                className="h-6 w-6 rounded-full"
                              />
                              <span className="text-sm text-gray-600">{talk.influencer.name}</span>
                              <span className="text-sm text-pink-600 font-bold">
                                ¥{formatPrice(talk.current_highest_bid)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 統計情報 */}
          <div className="grid grid-cols-3">
            <div className="p-3 text-center border-r-2 border-blue-200">
              <div className="text-xs text-gray-600">総支払額</div>
              <div className="text-sm font-bold text-pink-600">
                ¥{formatPrice(supabaseUser.total_spent || 0)}
              </div>
            </div>

            <div className="p-3 text-center border-r-2 border-blue-200">
              <div className="text-xs text-gray-600">通話数</div>
              <div className="text-sm font-bold text-green-600">
                {purchasedTalks.length}
              </div>
            </div>

            <div className="p-3 text-center">
              <div className="text-xs text-gray-600">予定</div>
              <div className="text-sm font-bold text-blue-600">
                {upcomingPurchasedTalks.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - スッキリ版 */}
      <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200">
        <div className="flex border border-gray-300 rounded-lg mx-6 my-4 overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              aria-label={tab.label}
              title={tab.label}
              className={`flex-1 flex items-center justify-center py-4 px-2 transition-colors border-r border-gray-300 last:border-r-0 ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-6 w-6" />
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - スッキリ版 */}
      <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-100 border-b-2 border-blue-200">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">プロフィール設定</h2>
              
              {(
                <div className="bg-blue-50 p-3 mb-4">
                  <p className="text-blue-800 text-sm">
                    💡 デモモードでは編集機能は表示されません。実際のアプリケーションでは、ここでプロフィールを編集できます。
                  </p>
                </div>
              )}
              
              {isEditingProfile ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-3">
                    <p className="text-blue-800 text-sm">
                      💡 表示名はヘッダー部分で直接編集できます。自己紹介とタグを編集してください。
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">自己紹介</label>
                    <textarea
                      value={editedBio}
                      onChange={(e) => setEditedBio(e.target.value.slice(0, 500))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm resize-none"
                      placeholder="自己紹介を入力してください"
                      maxLength={500}
                    />
                    <div className="text-right text-xs md:text-sm text-gray-500 mt-1">
                      {editedBio.length}/500
                    </div>
                  </div>
                      
                  <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">推しタグ</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {((profile?.oshi_tags || [])).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-pink-100 text-pink-700 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center space-x-2"
                        >
                          <span>{tag}</span>
                          <button
                            onClick={() => removeTag('oshi', index)}
                            className="text-pink-500 hover:text-pink-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag('oshi')}
                        className="flex-1 px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm md:text-base"
                        placeholder="推しタグを追加"
                      />
                      <button
                        onClick={() => addTag('oshi')}
                        className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors flex-shrink-0"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                        </div>
                      </div>
                      
                  <div>
                    <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">ファンタグ</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {((profile?.fan_tags || [])).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium flex items-center space-x-2"
                        >
                          <span>{tag}</span>
                          <button
                            onClick={() => removeTag('fan', index)}
                            className="text-purple-500 hover:text-purple-700"
                          >
                            <X className="h-3 w-3" />
                        </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag('fan')}
                        className="flex-1 px-3 py-2 md:px-4 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                        placeholder="ファンタグを追加"
                      />
                      <button
                        onClick={() => addTag('fan')}
                        className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex-shrink-0"
                      >
                        <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3">自己紹介</h3>
                    <p className="text-sm md:text-base text-gray-600 bg-gray-50 rounded-lg p-3 md:p-4">
                      {(supabaseUser?.bio || profile?.bio || '自己紹介が設定されていません')}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3">推しタグ</h3>
                    <div className="flex flex-wrap gap-2">
                      {((profile?.oshi_tags || [])).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-pink-100 text-pink-700 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3">ファンタグ</h3>
                    <div className="flex flex-wrap gap-2">
                      {((profile?.fan_tags || [])).map((tag, index) => (
                        <span
                          key={index}
                          className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rank Tab */}
          {activeTab === 'rank' && (
            <div className="space-y-4 md:space-y-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">Oshiランク & ステータス</h2>
              
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4 sm:p-6 border-2 border-pink-200">
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r ${getRankColor(profile.oshi_rank.color)} text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 shadow-lg max-w-full`}>
                    <Crown className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                    <span className="whitespace-nowrap">{profile.oshi_rank.title}</span>
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 animate-pulse" />
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 px-2">{profile.oshi_rank.description}</p>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{profile.oshi_rank.points}pt</div>
                  <div className="text-xs sm:text-sm text-gray-600">総ポイント</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">ポイント内訳</h3>
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm md:text-base text-gray-600">通話回数</span>
                      <span className="text-sm md:text-base font-semibold whitespace-nowrap">{profile?.call_count || 0}回 × 3pt = {(profile?.call_count || 0) * 3}pt</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm md:text-base text-gray-600">通話分数</span>
                      <span className="text-sm md:text-base font-semibold whitespace-nowrap">{profile?.call_minutes || 0}分 × 0.5pt = {(profile?.call_minutes || 0) * 0.5}pt</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm md:text-base text-gray-600">入札回数</span>
                      <span className="text-sm md:text-base font-semibold whitespace-nowrap">{profile?.bid_count || 0}回 × 1pt = {(profile?.bid_count || 0)}pt</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm md:text-base text-gray-600">イベント参加</span>
                      <span className="text-sm md:text-base font-semibold whitespace-nowrap">{profile?.event_count || 0}回 × 2pt = {(profile?.event_count || 0) * 2}pt</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                  <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">ランク一覧</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-green-50">
                      <span className="text-sm md:text-base">Newbie</span>
                      <span className="text-xs md:text-sm text-gray-500">0-19pt</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50">
                      <span className="text-sm md:text-base">Regular</span>
                      <span className="text-xs md:text-sm text-gray-500">20-69pt</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-purple-50">
                      <span className="text-sm md:text-base">Devoted</span>
                      <span className="text-xs md:text-sm text-gray-500">70-149pt</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-yellow-50">
                      <span className="text-sm md:text-base">Top Fan</span>
                      <span className="text-xs md:text-sm text-gray-500">150pt+</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Badges Tab */}
          {activeTab === 'badges' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">実績バッジ</h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoadingBadges ? (
                  <div className="col-span-full text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                    <p className="text-gray-600 mt-2">バッジを読み込み中...</p>
                  </div>
                ) : userBadges.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">まだバッジを獲得していません</p>
                    <p className="text-sm text-gray-500 mt-2">通話や入札をしてバッジを獲得しましょう！</p>
                  </div>
                ) : (
                  userBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`border-2 rounded-xl p-6 text-center cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg ${getBadgeRarityColor(badge.category)}`}
                    onClick={() => setSelectedBadge(badge)}
                  >
                    <div className="text-4xl mb-3">{badge.icon}</div>
                    <h3 className="font-bold text-gray-800 mb-2">{badge.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{badge.description}</p>
                    <div className="text-xs text-gray-500">
                      獲得日: {formatDate(badge.earned_at)}
                    </div>
                    <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                      badge.category === 'legendary' ? 'bg-yellow-200 text-yellow-800' :
                      badge.category === 'epic' ? 'bg-purple-200 text-purple-800' :
                      badge.category === 'rare' ? 'bg-blue-200 text-blue-800' :
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {badge.category.toUpperCase()}
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <h2 className="text-2xl font-bold text-gray-800">活動ログ</h2>
                
                <div className="flex space-x-4">
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="all">すべて</option>
                    <option value="call">通話</option>
                    <option value="bid">入札</option>
                    <option value="event">イベント</option>
                  </select>
                  
                  <select
                    value={activitySort}
                    onChange={(e) => setActivitySort(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="date">日付順</option>
                    <option value="type">種類順</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                {isLoadingActivity ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                    <p className="text-gray-600 mt-2">活動ログを読み込み中...</p>
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">まだ活動ログがありません</p>
                    <p className="text-sm text-gray-500 mt-2">通話や入札をして活動ログを増やしましょう！</p>
                  </div>
                ) : (
                  filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-pink-400 hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {activity.type === 'call' && <Video className="h-5 w-5 text-green-500" />}
                          {activity.type === 'bid' && <DollarSign className="h-5 w-5 text-blue-500" />}
                          {activity.type === 'event' && <Users className="h-5 w-5 text-purple-500" />}
                          <h3 className="font-semibold text-gray-800">{activity.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {activity.status === 'completed' ? '完了' :
                             activity.status === 'failed' ? '失敗' : '進行中'}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-3">{activity.description}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span>{formatDate(activity.date)}</span>
                          {activity.influencer_name && (
                            <span className="flex items-center space-x-1">
                              <Heart className="h-4 w-4" />
                              <span>{activity.influencer_name}</span>
                            </span>
                          )}
                          {activity.duration && (
                            <span className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{activity.duration}分</span>
                            </span>
                          )}
                          {activity.amount && (
                            <span className="flex items-center space-x-1">
                              <DollarSign className="h-4 w-4" />
                              <span>¥{formatPrice(activity.amount)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Collection Tab */}
          {activeTab === 'collection' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">コレクション</h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoadingCollection ? (
                  <div className="col-span-full text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                    <p className="text-gray-600 mt-2">コレクションを読み込み中...</p>
                  </div>
                ) : userCollection.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">まだコレクションがありません</p>
                    <p className="text-sm text-gray-500 mt-2">通話を購入してコレクションを増やしましょう！</p>
                  </div>
                ) : (
                  userCollection.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  >
                    <div className="relative">
                      <img
                        src={item.thumbnail}
                        alt={item.influencer_name}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                        {item.duration}分
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.influencer_name}</p>
                      <p className="text-sm text-gray-600 mb-3">{formatDate(item.purchased_at)}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">ステータス: {item.call_status}</span>
                        <button className="text-pink-500 hover:text-pink-700 text-sm font-medium">
                          詳細を見る
                        </button>
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="p-6 space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">プライバシー設定</h2>
              
              {(
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-blue-800 text-sm">
                    💡 デモモードでは設定変更は無効です。実際のアプリケーションでは、ここでプライバシー設定を変更できます。
                  </p>
                </div>
              )}
              
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">マイページ公開範囲</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="profile_visibility"
                        value="public"
                        checked={profile.privacy_settings.profile_visibility === 'public'}
                        onChange={(e) => setProfile({
                          ...profile,
                          privacy_settings: {
                            ...profile.privacy_settings,
                            profile_visibility: e.target.value as any
                          }
                        })}
                        disabled={isDemoMode}
                        className="text-pink-500"
                      />
                      <Globe className="h-5 w-5 text-green-500" />
                      <span>公開</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="profile_visibility"
                        value="link_only"
                        checked={profile.privacy_settings.profile_visibility === 'link_only'}
                        onChange={(e) => setProfile({
                          ...profile,
                          privacy_settings: {
                            ...profile.privacy_settings,
                            profile_visibility: e.target.value as any
                          }
                        })}
                        disabled={isDemoMode}
                        className="text-pink-500"
                      />
                      <Eye className="h-5 w-5 text-yellow-500" />
                      <span>リンクのみ</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="profile_visibility"
                        value="private"
                        checked={profile.privacy_settings.profile_visibility === 'private'}
                        onChange={(e) => setProfile({
                          ...profile,
                          privacy_settings: {
                            ...profile.privacy_settings,
                            profile_visibility: e.target.value as any
                          }
                        })}
                        disabled={isDemoMode}
                        className="text-pink-500"
                      />
                      <Lock className="h-5 w-5 text-red-500" />
                      <span>非公開</span>
                    </label>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">通話履歴の公開</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="call_history_visibility"
                        value="public"
                        checked={profile.privacy_settings.call_history_visibility === 'public'}
                        onChange={(e) => setProfile({
                          ...profile,
                          privacy_settings: {
                            ...profile.privacy_settings,
                            call_history_visibility: e.target.value as any
                          }
                        })}
                        disabled={isDemoMode}
                        className="text-pink-500"
                      />
                      <Eye className="h-5 w-5 text-green-500" />
                      <span>公開</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="call_history_visibility"
                        value="private"
                        checked={profile.privacy_settings.call_history_visibility === 'private'}
                        onChange={(e) => setProfile({
                          ...profile,
                          privacy_settings: {
                            ...profile.privacy_settings,
                            call_history_visibility: e.target.value as any
                          }
                        })}
                        disabled={isDemoMode}
                        className="text-pink-500"
                      />
                      <EyeOff className="h-5 w-5 text-red-500" />
                      <span>非公開</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">{selectedBadge.icon}</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedBadge.name}</h3>
              <p className="text-gray-600 mb-4">{selectedBadge.description}</p>
              <div className="text-sm text-gray-500 mb-6">
                獲得日: {formatDate(selectedBadge.earned_at)}
              </div>
              <button
                onClick={() => setSelectedBadge(null)}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Call Slot Form Modal */}
      {showCreateForm && supabaseUser?.is_influencer && (
        <CreateCallSlotForm
          influencerId={supabaseUser.id}
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Talk枠編集モーダル */}
      {editingCallSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
              <EditIcon className="h-5 w-5 text-purple-600" />
              <span>Talk枠を編集</span>
            </h3>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* タイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="例: 30分トーク"
                />
              </div>

              {/* 説明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Talk枠の説明を入力してください"
                />
              </div>

              {/* 通話開始時間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  通話開始時間 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={editForm.scheduled_start_time}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditForm({ ...editForm, scheduled_start_time: value });

                    // 通話開始時間が変更されたら、オークション終了時間を自動設定
                    if (value) {
                      const scheduledTime = new Date(value);
                      const now = new Date();
                      const timeUntilStart = scheduledTime.getTime() - now.getTime();
                      const hoursUntilStart = timeUntilStart / (60 * 60 * 1000);

                      console.log('📅 Talk開始時間:', scheduledTime.toLocaleString('ja-JP'));
                      console.log('⏱️  現在時刻からの時間差:', hoursUntilStart.toFixed(2), '時間');

                      let auctionEndTime: Date;

                      // 48時間以内の場合は、Talk枠の5分前に設定
                      if (hoursUntilStart <= 48) {
                        auctionEndTime = new Date(scheduledTime.getTime() - 5 * 60 * 1000); // 5分前
                        console.log('✅ 48時間以内 → 5分前に設定:', auctionEndTime.toLocaleString('ja-JP'));
                      } else {
                        // 48時間以上先の場合は、24時間前に設定
                        auctionEndTime = new Date(scheduledTime.getTime() - 24 * 60 * 60 * 1000); // 24時間前
                        console.log('✅ 48時間以降 → 24時間前に設定:', auctionEndTime.toLocaleString('ja-JP'));
                      }

                      // datetime-local形式に変換（ローカルタイムゾーン）
                      const year = auctionEndTime.getFullYear();
                      const month = String(auctionEndTime.getMonth() + 1).padStart(2, '0');
                      const day = String(auctionEndTime.getDate()).padStart(2, '0');
                      const hours = String(auctionEndTime.getHours()).padStart(2, '0');
                      const minutes = String(auctionEndTime.getMinutes()).padStart(2, '0');
                      const formattedTime = `${year}-${month}-${day}T${hours}:${minutes}`;

                      console.log('📝 設定するオークション終了時間:', formattedTime);
                      setEditForm(prev => ({ ...prev, auction_end_time: formattedTime }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* 通話時間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  通話時間（分） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editForm.duration_minutes}
                  onChange={(e) => setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={10}
                  step={5}
                />
              </div>

              {/* 開始価格 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  開始価格（円） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editForm.starting_price}
                  onChange={(e) => setEditForm({ ...editForm, starting_price: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={100}
                  step={100}
                />
              </div>

              {/* 最小入札増分 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最小入札増分（円） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editForm.minimum_bid_increment}
                  onChange={(e) => setEditForm({ ...editForm, minimum_bid_increment: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={100}
                  step={100}
                />
              </div>

              {/* 即決価格設定 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editHasBuyNowPrice"
                    checked={editHasBuyNowPrice}
                    onChange={(e) => {
                      setEditHasBuyNowPrice(e.target.checked);
                      if (!e.target.checked) {
                        setEditForm({ ...editForm, buy_now_price: null });
                      }
                    }}
                    className="h-4 w-4 text-purple-500 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="editHasBuyNowPrice" className="text-sm font-medium text-gray-700">
                    即決価格を設定する
                  </label>
                </div>

                {editHasBuyNowPrice && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      即決価格（円） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={editForm.buy_now_price || ''}
                      onChange={(e) => setEditForm({ ...editForm, buy_now_price: parseInt(e.target.value) })}
                      min={editForm.starting_price + 100}
                      step={100}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={`${editForm.starting_price + 500}以上`}
                      required={editHasBuyNowPrice}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ※ この価格で即座に落札できます。開始価格より高く設定してください。
                    </p>
                  </div>
                )}
              </div>

              {/* サムネイル画像 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  サムネイル画像
                </label>
                <div className="space-y-3">
                  {editImagePreview && (
                    <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={editImagePreview}
                        alt="プレビュー"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">クリックして画像を選択</span>
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF (最大 10MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const { validateImageFile, getImagePreviewUrl } = await import('../lib/storage');
                          const validation = validateImageFile(file);
                          if (!validation.valid) {
                            alert(validation.error || '画像ファイルが無効です');
                            return;
                          }
                          setEditImageFile(file);
                          setEditImagePreview(getImagePreviewUrl(file));
                        }
                      }}
                    />
                  </label>
                  {editImagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditImageFile(null);
                        setEditImagePreview('');
                        setEditForm({ ...editForm, thumbnail_url: undefined });
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      画像を削除
                    </button>
                  )}
                </div>
              </div>

              {/* オークション終了時間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  オークション終了時間
                </label>
                <input
                  type="datetime-local"
                  value={editForm.auction_end_time}
                  onChange={(e) => setEditForm({ ...editForm, auction_end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min={new Date().toISOString().slice(0, 16)}
                  max={editForm.scheduled_start_time}
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※ 通話開始時間より前に設定してください（デフォルト: 48時間以上先の場合は開始時間の24時間前、48時間以内の場合は開始時間の5分前）
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveCallSlot}
                disabled={saving || !editForm.title || !editForm.scheduled_start_time}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>保存</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancelEditCallSlot}
                disabled={saving}
                className="flex-1 bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
