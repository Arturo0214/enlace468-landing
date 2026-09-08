import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2 } from 'lucide-react'

export default function AdPreview({ headline, body, cta, companyName, imageUrl, platform = 'facebook' }) {
  const displayName = companyName || 'SELECTA Consultores'
  const initial = displayName[0]?.toUpperCase() || 'S'

  if (platform === 'instagram') {
    return (
      <div className="w-full max-w-[320px] rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dbdbdb' }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-ink text-xs font-bold" style={{ background: '#3b82f6' }}>{initial}</div>
          <div className="flex-1">
            <p className="text-xs font-semibold" style={{ color: '#262626' }}>{displayName}</p>
            <p className="text-[10px]" style={{ color: '#8e8e8e' }}>Publicidad</p>
          </div>
          <MoreHorizontal size={16} style={{ color: '#262626' }} />
        </div>
        {imageUrl ? (
          <img src={imageUrl} alt="Ad creative" className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center" style={{ background: '#f0f0f0' }}>
            <p className="text-sm font-bold text-center px-6" style={{ color: '#262626' }}>{headline || 'Creative'}</p>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-4">
            <Heart size={20} style={{ color: '#262626' }} />
            <MessageCircle size={20} style={{ color: '#262626' }} />
            <Send size={20} style={{ color: '#262626' }} />
          </div>
          <Bookmark size={20} style={{ color: '#262626' }} />
        </div>
        <div className="px-3 pb-2">
          <p className="text-xs" style={{ color: '#262626' }}>
            <span className="font-semibold">{displayName}</span>{' '}
            {body ? (body.length > 80 ? body.slice(0, 80) + '...' : body) : ''}
          </p>
        </div>
        <div className="px-3 pb-3">
          <button className="w-full py-2 rounded-lg text-ink text-xs font-semibold" style={{ background: '#3b82f6' }}>
            {cta || 'Enviar mensaje'}
          </button>
        </div>
      </div>
    )
  }

  // Facebook
  return (
    <div className="w-full max-w-[360px] rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e0e0e0' }}>
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-ink text-sm font-bold" style={{ background: '#3b82f6' }}>{initial}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: '#050505' }}>{displayName}</p>
          <p className="text-[11px]" style={{ color: '#65676b' }}>Publicidad · 🌐</p>
        </div>
        <MoreHorizontal size={16} style={{ color: '#65676b' }} />
      </div>
      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed" style={{ color: '#050505' }}>
          {body || ''}
        </p>
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt="Ad creative" className="w-full object-cover" style={{ borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0' }} />
      ) : (
        <div className="w-full aspect-[1.91/1] flex items-center justify-center" style={{ background: '#f0f2f5', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0' }}>
          <p className="text-lg font-bold text-center px-8" style={{ color: '#050505' }}>{headline || 'Creative'}</p>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#f0f2f5', borderBottom: '1px solid #e0e0e0' }}>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase" style={{ color: '#65676b' }}>enlace468.com</p>
          <p className="text-sm font-medium truncate" style={{ color: '#050505' }}>{headline || ''}</p>
        </div>
        <button className="px-4 py-1.5 rounded text-xs font-semibold flex-shrink-0 ml-3" style={{ background: '#e4e6eb', color: '#050505' }}>
          {cta || 'Enviar mensaje'}
        </button>
      </div>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #e0e0e0' }}>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-xs" style={{ color: '#65676b' }}>
            <ThumbsUp size={14} /> Me gusta
          </button>
          <button className="flex items-center gap-1.5 text-xs" style={{ color: '#65676b' }}>
            <MessageCircle size={14} /> Comentar
          </button>
          <button className="flex items-center gap-1.5 text-xs" style={{ color: '#65676b' }}>
            <Share2 size={14} /> Compartir
          </button>
        </div>
      </div>
    </div>
  )
}
