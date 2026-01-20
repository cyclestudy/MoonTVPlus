'use client';

import { useEffect, useRef, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { Radio } from 'lucide-react';
import Head from 'next/head';

let Artplayer: any = null;
let Hls: any = null;
let flvjs: any = null;

export default function WebLivePage() {
  const artRef = useRef<HTMLDivElement | null>(null);
  const artPlayerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'loading' | 'fetching' | 'ready'>('loading');
  const [loadingMessage, setLoadingMessage] = useState('正在加载直播源...');
  const [sources, setSources] = useState<any[]>([]);
  const [currentSource, setCurrentSource] = useState<any | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'rooms' | 'platforms'>('rooms');
  const [isChannelListCollapsed, setIsChannelListCollapsed] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);

    if (typeof window !== 'undefined') {
      import('artplayer').then(mod => { Artplayer = mod.default; });
      import('hls.js').then(mod => { Hls = mod.default; });
      import('flv.js').then(mod => { flvjs = mod.default; });
    }
    fetchSources();

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      setLoadingStage('loading');
      setLoadingMessage('正在加载直播源...');
      const res = await fetch('/api/web-live/sources');
      if (res.ok) {
        setLoadingStage('fetching');
        const data = await res.json();
        setSources(data);
        setLoadingStage('ready');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error('获取直播源失败:', err);
    } finally {
      setLoading(false);
    }
  };

  function m3u8Loader(video: HTMLVideoElement, url: string) {
    if (!Hls) return;
    const hls = new Hls({ debug: false, enableWorker: true, lowLatencyMode: true });
    hls.loadSource(url);
    hls.attachMedia(video);
    (video as any).hls = hls;
  }

  function flvLoader(video: HTMLVideoElement, url: string) {
    if (!flvjs) return;
    const flvPlayer = flvjs.createPlayer({ type: 'flv', url, isLive: true });
    flvPlayer.attachMediaElement(video);
    flvPlayer.on(flvjs.Events.ERROR, (errorType: string, errorDetail: string) => {
      console.error('FLV.js error:', errorType, errorDetail);
      setErrorMessage(`播放失败: ${errorType} - ${errorDetail}`);
      setVideoUrl('');
    });
    flvPlayer.load();
    (video as any).flvPlayer = flvPlayer;
  }

  useEffect(() => {
    if (!Artplayer || !Hls || !flvjs || !videoUrl || !artRef.current) return;

    if (artPlayerRef.current) {
      artPlayerRef.current.destroy();
    }

    artPlayerRef.current = new Artplayer({
      container: artRef.current,
      url: videoUrl,
      isLive: true,
      autoplay: true,
      customType: {
        m3u8: m3u8Loader,
        flv: flvLoader
      },
      icons: { loading: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 100 100"><circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="4" r="35" stroke-dasharray="164.93361431346415 56.97787143782138"><animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 50 50;360 50 50" keyTimes="0;1"/></circle></svg>' }
    });

    return () => {
      if (artPlayerRef.current) {
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
      }
    };
  }, [videoUrl]);

  const handleSourceClick = async (source: any) => {
    setCurrentSource(source);
    setIsVideoLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/web-live/stream?platform=${source.platform}&roomId=${source.roomId}`);
      if (res.ok) {
        const data = await res.json();
        setVideoUrl(data.url);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || '获取直播流失败');
      }
    } catch (err) {
      console.error('获取直播流失败:', err);
      setErrorMessage(err instanceof Error ? err.message : '获取直播流失败');
    } finally {
      setIsVideoLoading(false);
    }
  };

  const platforms = Array.from(new Set(sources.map(s => s.platform)));

  if (loading) {
    return (
      <PageLayout activePath='/web-live'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画直播图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>📺</div>
                {/* 旋转光环 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
              </div>

              {/* 浮动粒子效果 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 进度指示器 */}
            <div className='mb-6 w-80 mx-auto'>
              <div className='flex justify-center space-x-2 mb-4'>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'loading' ? 'bg-green-500 scale-125' : 'bg-green-500'}`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'fetching' ? 'bg-green-500 scale-125' : 'bg-green-500'}`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'ready' ? 'bg-green-500 scale-125' : 'bg-gray-300'}`}
                ></div>
              </div>

              {/* 进度条 */}
              <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out'
                  style={{
                    width: loadingStage === 'loading' ? '33%' : loadingStage === 'fetching' ? '66%' : '100%',
                  }}
                ></div>
              </div>
            </div>

            {/* 加载消息 */}
            <div className='space-y-2'>
              <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                {loadingMessage}
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/web-live'>
      <div className='flex flex-col gap-3 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 max-w-[80%]'>
            <Radio className='w-5 h-5 text-blue-500 flex-shrink-0' />
            <div className='min-w-0 flex-1'>
              <div className='truncate'>
                {currentSource?.name || '网络直播'}
              </div>
            </div>
          </h1>
        </div>

        <div className='space-y-2'>
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() => setIsChannelListCollapsed(!isChannelListCollapsed)}
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isChannelListCollapsed ? 'rotate-180' : 'rotate-0'}`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7' />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isChannelListCollapsed ? '显示' : '隐藏'}
              </span>
              <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${isChannelListCollapsed ? 'bg-orange-400 animate-pulse' : 'bg-green-400'}`}></div>
            </button>
          </div>

          <div className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${isChannelListCollapsed ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-4'}`}>
            <div className={`h-full transition-all duration-300 ease-in-out ${isChannelListCollapsed ? 'col-span-1' : 'md:col-span-3'}`}>
              <div className='relative w-full h-[300px] lg:h-full'>
                <div ref={artRef} className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30'></div>

                {errorMessage && (
                  <div className='absolute inset-0 bg-black/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30 flex items-center justify-center z-[600] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>⚠️</div>
                          <div className='absolute -inset-2 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl opacity-20 animate-pulse'></div>
                        </div>
                      </div>
                      <div className='space-y-4'>
                        <h3 className='text-xl font-semibold text-white'>获取直播流失败</h3>
                        <div className='bg-orange-500/20 border border-orange-500/30 rounded-lg p-4'>
                          <p className='text-orange-300 font-medium'>{errorMessage}</p>
                        </div>
                        <p className='text-sm text-gray-300'>请尝试其他房间</p>
                      </div>
                    </div>
                  </div>
                )}

                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30 flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>📺</div>
                          <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <p className='text-xl font-semibold text-white animate-pulse'>🔄 加载中...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${isChannelListCollapsed ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95' : 'md:col-span-1 lg:opacity-100 lg:scale-100'}`}>
              <div className='md:ml-2 px-4 py-0 h-full rounded-xl bg-black/10 dark:bg-white/5 flex flex-col border border-white/0 dark:border-white/30 overflow-hidden'>
                <div className='flex mb-1 -mx-6 flex-shrink-0'>
                  <div
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium ${activeTab === 'rooms' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'}`}
                  >
                    房间
                  </div>
                  <div
                    onClick={() => setActiveTab('platforms')}
                    className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium ${activeTab === 'platforms' ? 'text-green-600 dark:text-green-400' : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'}`}
                  >
                    平台
                  </div>
                </div>

                {activeTab === 'rooms' && (
                  <div className='flex-1 overflow-y-auto space-y-2 pb-4 mt-4'>
                    {sources.length > 0 ? (
                      sources.map((source) => {
                        const isActive = source.key === currentSource?.key;
                        return (
                          <button
                            key={source.key}
                            onClick={() => handleSourceClick(source)}
                            className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${isActive ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                          >
                            <div className='flex items-center gap-3'>
                              <div className='w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0'>
                                <Radio className='w-5 h-5 text-gray-500' />
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>{source.name}</div>
                                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>房间ID: {source.roomId}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className='flex flex-col items-center justify-center py-12 text-center'>
                        <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                          <Radio className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                        </div>
                        <p className='text-gray-500 dark:text-gray-400 font-medium'>暂无可用房间</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'platforms' && (
                  <div className='flex flex-col h-full mt-4'>
                    <div className='flex-1 overflow-y-auto space-y-2 pb-20'>
                      {platforms.length > 0 ? (
                        platforms.map((platform) => (
                          <div key={platform} className='flex items-start gap-3 px-2 py-3 rounded-lg bg-gray-200/50 dark:bg-white/10'>
                            <div className='w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0'>
                              <Radio className='w-6 h-6 text-gray-500' />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                                {platform === 'huya' ? '虎牙' : platform}
                              </div>
                              <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                                {sources.filter(s => s.platform === platform).length} 个房间
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className='flex flex-col items-center justify-center py-12 text-center'>
                          <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                            <Radio className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                          </div>
                          <p className='text-gray-500 dark:text-gray-400 font-medium'>暂无可用平台</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
