import { supabase } from '../../core/services/supabaseClient';
import {
  CustomerAction,
  CustomerInsight,
  CustomerAchievement,
  CustomerGoal,
  SocialShare,
  ProductReview,
  AffiliateProgram,
  AffiliateReferral,
  AffiliateMaterial,
  AffiliatePayment,
  CustomerActionType,
  InsightType,
  AchievementType
} from '../../core/types/types';

export const customerProfileService = {
  // ============================================
  // Aé‡é•ES E PONTOS
  // ============================================

  /**
   * Registrar uma açéo do cliente e conceder pontos
   */
  async recordAction(
    customerId: string,
    actionType: CustomerActionType | string,
    points: number,
    metadata?: Record<string, any>
  ): Promise<CustomerAction | null> {
    try {
      const { data, error } = await supabase.rpc('record_customer_action', {
        p_customer_id: customerId,
        p_action_type: actionType,
        p_points: points,
        p_metadata: metadata || null
      });

      if (error) throw error;

      // Buscar a açéo criada
      const { data: action, error: fetchError } = await supabase
        .from('customer_actions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      return {
        id: action.id,
        customerId: action.customer_id,
        actionType: action.action_type,
        pointsEarned: action.points_earned,
        metadata: action.metadata,
        createdAt: action.created_at
      };
    } catch (error: any) {
      console.error('Erro ao registrar açéo:', error);
      return null;
    }
  },

  /**
   * Buscar histórico de ações do cliente
   */
  async getCustomerActions(customerId: string): Promise<CustomerAction[]> {
    try {
      const { data, error } = await supabase
        .from('customer_actions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(action => ({
        id: action.id,
        customerId: action.customer_id,
        actionType: action.action_type,
        pointsEarned: action.points_earned,
        metadata: action.metadata,
        createdAt: action.created_at
      }));
    } catch (error: any) {
      console.error('Erro ao buscar ações:', error);
      return [];
    }
  },

  // ============================================
  // INSIGHTS
  // ============================================

  /**
   * Buscar todos os insights do cliente
   */
  async getCustomerInsights(
    customerId: string,
    period?: string
  ): Promise<CustomerInsight[]> {
    try {
      let query = supabase
        .from('customer_insights')
        .select('*')
        .eq('customer_id', customerId);

      if (period) {
        query = query.eq('period', period);
      }

      const { data, error } = await query.order('calculated_at', {
        ascending: false
      });

      if (error) throw error;

      return (data || []).map(insight => ({
        id: insight.id,
        customerId: insight.customer_id,
        insightType: insight.insight_type,
        value: insight.value,
        valueText: insight.value_text,
        period: insight.period,
        metadata: insight.metadata,
        calculatedAt: insight.calculated_at
      }));
    } catch (error: any) {
      console.error('Erro ao buscar insights:', error);
      return [];
    }
  },

  /**
   * Calcular e atualizar insights do cliente
   */
  async calculateCustomerInsights(customerId: string): Promise<boolean> {
    try {
      // Esta funçéo seria chamada pelo backend para calcular insights
      // Por enquanto, retornamos true
      // Em produçéo, isso seria uma funçéo server-side
      return true;
    } catch (error: any) {
      console.error('Erro ao calcular insights:', error);
      return false;
    }
  },

  // ============================================
  // CONQUISTAS
  // ============================================

  /**
   * Buscar conquistas do cliente
   */
  async getCustomerAchievements(
    customerId: string
  ): Promise<CustomerAchievement[]> {
    try {
      const { data, error } = await supabase
        .from('customer_achievements')
        .select('*')
        .eq('customer_id', customerId)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(achievement => ({
        id: achievement.id,
        customerId: achievement.customer_id,
        achievementType: achievement.achievement_type,
        unlockedAt: achievement.unlocked_at,
        metadata: achievement.metadata
      }));
    } catch (error: any) {
      console.error('Erro ao buscar conquistas:', error);
      return [];
    }
  },

  /**
   * Verificar e conceder conquista
   */
  async checkAndGrantAchievement(
    customerId: string,
    achievementType: AchievementType | string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_and_grant_achievement', {
        p_customer_id: customerId,
        p_achievement_type: achievementType,
        p_metadata: metadata || null
      });

      if (error) throw error;
      return data === true;
    } catch (error: any) {
      console.error('Erro ao conceder conquista:', error);
      return false;
    }
  },

  // ============================================
  // METAS
  // ============================================

  /**
   * Buscar metas do cliente
   */
  async getCustomerGoals(
    customerId: string,
    status?: string
  ): Promise<CustomerGoal[]> {
    try {
      let query = supabase
        .from('customer_goals')
        .select('*')
        .eq('customer_id', customerId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', {
        ascending: false
      });

      if (error) throw error;

      return (data || []).map(goal => ({
        id: goal.id,
        customerId: goal.customer_id,
        goalType: goal.goal_type,
        title: goal.title,
        description: goal.description,
        targetValue: goal.target_value,
        currentValue: goal.current_value,
        deadline: goal.deadline,
        status: goal.status,
        rewardPoints: goal.reward_points,
        completedAt: goal.completed_at,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at
      }));
    } catch (error: any) {
      console.error('Erro ao buscar metas:', error);
      return [];
    }
  },

  /**
   * Criar nova meta
   */
  async createCustomerGoal(goal: Partial<CustomerGoal>): Promise<CustomerGoal | null> {
    try {
      const { data, error } = await supabase
        .from('customer_goals')
        .insert({
          customer_id: goal.customerId,
          goal_type: goal.goalType,
          title: goal.title,
          description: goal.description,
          target_value: goal.targetValue,
          current_value: goal.currentValue || 0,
          deadline: goal.deadline,
          status: goal.status || 'active',
          reward_points: goal.rewardPoints || 0
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        customerId: data.customer_id,
        goalType: data.goal_type,
        title: data.title,
        description: data.description,
        targetValue: data.target_value,
        currentValue: data.current_value,
        deadline: data.deadline,
        status: data.status,
        rewardPoints: data.reward_points,
        completedAt: data.completed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error: any) {
      console.error('Erro ao criar meta:', error);
      return null;
    }
  },

  /**
   * Atualizar progresso de meta
   */
  async updateGoalProgress(
    goalId: string,
    increment: number = 1
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_customer_goal_progress', {
        p_goal_id: goalId,
        p_increment: increment
      });

      if (error) throw error;
      return data === true;
    } catch (error: any) {
      console.error('Erro ao atualizar progresso:', error);
      return false;
    }
  },

  // ============================================
  // PARTILHAS SOCIAIS
  // ============================================

  /**
   * Partilhar produto em rede social
   */
  async shareProduct(
    customerId: string,
    productId: string,
    platform: 'whatsapp' | 'facebook' | 'instagram' | 'twitter' | 'other',
    points: number = 10
  ): Promise<SocialShare | null> {
    try {
      // Registrar partilha
      const { data, error } = await supabase
        .from('social_shares')
        .insert({
          customer_id: customerId,
          product_id: productId,
          platform: platform,
          points_earned: points
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar açéo e conceder pontos
      await this.recordAction(
        customerId,
        CustomerActionType.PARTILHAR_PRODUTO,
        points,
        { productId, platform }
      );

      return {
        id: data.id,
        customerId: data.customer_id,
        productId: data.product_id,
        platform: data.platform,
        shareUrl: data.share_url,
        pointsEarned: data.points_earned,
        createdAt: data.created_at
      };
    } catch (error: any) {
      console.error('Erro ao partilhar produto:', error);
      return null;
    }
  },

  /**
   * Buscar partilhas do cliente
   */
  async getCustomerShares(customerId: string): Promise<SocialShare[]> {
    try {
      const { data, error } = await supabase
        .from('social_shares')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(share => ({
        id: share.id,
        customerId: share.customer_id,
        productId: share.product_id,
        platform: share.platform,
        shareUrl: share.share_url,
        pointsEarned: share.points_earned,
        createdAt: share.created_at
      }));
    } catch (error: any) {
      console.error('Erro ao buscar partilhas:', error);
      return [];
    }
  },

  // ============================================
  // REVIEWS DE PRODUTOS
  // ============================================

  /**
   * Criar review de produto
   */
  async createReview(
    customerId: string,
    productId: string,
    rating: number,
    reviewText?: string
  ): Promise<ProductReview | null> {
    try {
      const points = reviewText ? 50 : 20; // Review detalhada = mais pontos

      const { data, error } = await supabase
        .from('product_reviews')
        .insert({
          customer_id: customerId,
          product_id: productId,
          rating: rating,
          review_text: reviewText,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar açéo e conceder pontos
      await this.recordAction(
        customerId,
        reviewText ? CustomerActionType.CRIAR_REVIEW : CustomerActionType.AVALIAR_PRODUTO,
        points,
        { productId, rating, hasText: !!reviewText }
      );

      return {
        id: data.id,
        customerId: data.customer_id,
        productId: data.product_id,
        rating: data.rating,
        reviewText: data.review_text,
        helpfulCount: data.helpful_count,
        verifiedPurchase: data.verified_purchase,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error: any) {
      console.error('Erro ao criar review:', error);
      return null;
    }
  },

  /**
   * Buscar reviews do cliente
   */
  async getCustomerReviews(customerId: string): Promise<ProductReview[]> {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*, products(name)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(review => ({
        id: review.id,
        customerId: review.customer_id,
        productId: review.product_id,
        rating: review.rating,
        reviewText: review.review_text,
        helpfulCount: review.helpful_count,
        verifiedPurchase: review.verified_purchase,
        status: review.status,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
        productName: review.products?.name
      }));
    } catch (error: any) {
      console.error('Erro ao buscar reviews:', error);
      return [];
    }
  },

  // ============================================
  // PROGRAMA DE AFILIADOS
  // ============================================

  /**
   * Buscar dados do programa de afiliados do cliente
   */
  async getAffiliateData(customerId: string): Promise<AffiliateProgram | null> {
    try {
      // maybeSingle() evita 406 quando não há linha (cliente sem programa de afiliados)
      const { data, error } = await supabase
        .from('affiliate_program')
        .select('*, customers(name)')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null; // Sem programa de afiliados - retorna null sem erro

      return {
        id: data.id,
        customerId: data.customer_id,
        affiliateCode: data.affiliate_code,
        affiliateLink: data.affiliate_link,
        commissionRateLevel1: data.commission_rate_level1,
        commissionRateLevel2: data.commission_rate_level2,
        commissionRateRecurring: data.commission_rate_recurring,
        totalEarnings: data.total_earnings,
        totalReferrals: data.total_referrals,
        totalClicks: data.total_clicks,
        totalConversions: data.total_conversions,
        conversionRate: data.conversion_rate,
        status: data.status,
        tier: data.tier,
        paymentMethod: data.payment_method,
        paymentThreshold: data.payment_threshold,
        bankAccount: data.bank_account,
        mobileMoney: data.mobile_money,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        customerName: data.customers?.name
      };
    } catch (error: any) {
      console.error('Erro ao buscar dados de afiliado:', error);
      return null;
    }
  },

  /**
   * Criar programa de afiliado para cliente
   */
  async createAffiliateProgram(customerId: string): Promise<AffiliateProgram | null> {
    try {
      const { data, error } = await supabase.rpc('create_affiliate_program', {
        p_customer_id: customerId
      });

      if (error) throw error;

      // Buscar programa criado
      return await this.getAffiliateData(customerId);
    } catch (error: any) {
      console.error('Erro ao criar programa de afiliado:', error);
      return null;
    }
  },

  /**
   * Buscar referéªncias do afiliado
   */
  async getAffiliateReferrals(affiliateId: string): Promise<AffiliateReferral[]> {
    try {
      const { data, error } = await supabase
        .from('affiliate_referrals')
        .select('*, customers(name), affiliate_program(affiliate_code)')
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(ref => ({
        id: ref.id,
        affiliateId: ref.affiliate_id,
        referredCustomerId: ref.referred_customer_id,
        referralCode: ref.referral_code,
        referralType: ref.referral_type,
        referralLevel: ref.referral_level,
        clickTimestamp: ref.click_timestamp,
        conversionDate: ref.conversion_date,
        firstOrderId: ref.first_order_id,
        commissionAmount: ref.commission_amount,
        totalCommissionEarned: ref.total_commission_earned,
        status: ref.status,
        ipAddress: ref.ip_address,
        userAgent: ref.user_agent,
        metadata: ref.metadata,
        createdAt: ref.created_at,
        updatedAt: ref.updated_at,
        referredCustomerName: ref.customers?.name,
        affiliateCode: ref.affiliate_program?.affiliate_code
      }));
    } catch (error: any) {
      console.error('Erro ao buscar referências:', error);
      return [];
    }
  },

  /**
   * Buscar materiais de marketing
   */
  async getAffiliateMaterials(): Promise<AffiliateMaterial[]> {
    try {
      const { data, error } = await supabase
        .from('affiliate_materials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(material => ({
        id: material.id,
        title: material.title,
        description: material.description,
        type: material.type,
        fileUrl: material.file_url,
        thumbnailUrl: material.thumbnail_url,
        category: material.category,
        platform: material.platform,
        isActive: material.is_active,
        downloadCount: material.download_count,
        createdAt: material.created_at,
        updatedAt: material.updated_at
      }));
    } catch (error: any) {
      console.error('Erro ao buscar materiais:', error);
      return [];
    }
  },

  /**
   * Buscar pagamentos do afiliado
   */
  async getAffiliatePayments(affiliateId: string): Promise<AffiliatePayment[]> {
    try {
      const { data, error } = await supabase
        .from('affiliate_payments')
        .select('*, affiliate_program(affiliate_code)')
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(payment => ({
        id: payment.id,
        affiliateId: payment.affiliate_id,
        referralId: payment.referral_id,
        orderId: payment.order_id,
        commissionAmount: payment.commission_amount,
        paymentAmount: payment.payment_amount,
        paymentStatus: payment.payment_status,
        paymentMethod: payment.payment_method,
        paymentDate: payment.payment_date,
        paymentReference: payment.payment_reference,
        notes: payment.notes,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
        affiliateCode: payment.affiliate_program?.affiliate_code
      }));
    } catch (error: any) {
      console.error('Erro ao buscar pagamentos:', error);
      return [];
    }
  },

  /**
   * Registrar clique em link de afiliado
   */
  async recordAffiliateClick(
    referralCode: string,
    ipAddress?: string,
    userAgent?: string,
    refererUrl?: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('record_affiliate_click', {
        p_referral_code: referralCode,
        p_ip_address: ipAddress || null,
        p_user_agent: userAgent || null,
        p_referer_url: refererUrl || null
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Erro ao registrar clique:', error);
      return null;
    }
  }
};



