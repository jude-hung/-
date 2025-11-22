import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import { Upload, Camera, Shirt, Sparkles, ArrowRight, RefreshCw, Download, Image as ImageIcon, CheckCircle2 } from "lucide-react";

// --- Configuration & Presets ---

// Placeholder for the uploaded logo - replace with the actual URL if available
const LOGO_URL = "https://via.placeholder.com/40x40?text=RuiMi"; 

const PRESET_PEOPLE = [
  "https://img1.baidu.com/it/u=18575256,2754128776&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=688",
  "https://img0.baidu.com/it/u=409602931,4194272523&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=658",
  "https://img2.baidu.com/it/u=2699865500,847697480&fm=253&fmt=auto&app=138&f=JPEG?w=560&h=500",
];

const PRESET_CLOTHES = [
  "https://qcloud.dpfile.com/pc/5e5VCSgrY-r33wQePJmttSe4ek8LoBLeG2A96PfmoMNXwPOWtnn0FOdUMbwNw3H0.jpg",
  "https://img1.baidu.com/it/u=992083839,790000789&fm=253&fmt=auto&app=138&f=JPEG?w=800&h=1069",
  "https://img1.baidu.com/it/u=458620666,3174621201&fm=253&app=138&f=JPEG?w=800&h=945",
];

// --- Helper Functions ---

// Convert a URL to Base64 (handling CORS if possible, otherwise falling back)
const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove data:image/jpeg;base64, prefix for API usage
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("CORS or Fetch error, using proxy/canvas method might be needed for production.", error);
    // Fallback for demo purposes if direct fetch fails (browser security often blocks this)
    // In a real app, you'd use a proxy. For now, we alert the user.
    alert("无法直接加载此预设图片（跨域限制）。请尝试下载该图片并手动上传，或者使用本地图片。");
    throw error;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Components ---

const Card3D = ({ 
  image, 
  title, 
  isActive, 
  rotateY, 
  rotateZ = 0, 
  placeholderIcon: Icon,
  description
}: { 
  image: string | null, 
  title: string, 
  isActive: boolean, 
  rotateY: number, 
  rotateZ?: number,
  placeholderIcon: any,
  description: string
}) => {
  return (
    <div 
      className="card-3d relative w-48 h-72 rounded-2xl bg-white overflow-hidden border-4 border-white transition-all duration-500"
      style={{
        transform: `rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) translateZ(${isActive ? 20 : 0}px) scale(${isActive ? 1.05 : 0.95})`,
        opacity: isActive ? 1 : 0.8,
      }}
    >
      {image ? (
        <img src={image} alt={title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-4 text-center">
          <Icon size={48} className="mb-4 opacity-50" />
          <p className="font-medium text-sm text-gray-500">{title}</p>
          <p className="text-xs mt-2 opacity-60">{description}</p>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
        <p className="text-white font-medium text-sm">{title}</p>
      </div>
    </div>
  );
};

const AIChangeClothesApp = () => {
  // Steps: 0 = Select Person, 1 = Select Clothes, 2 = Result
  const [currentStep, setCurrentStep] = useState(0);
  
  const [personImg, setPersonImg] = useState<{url: string, base64: string | null}>({ url: "", base64: null });
  const [clothImg, setClothImg] = useState<{url: string, base64: string | null}>({ url: "", base64: null });
  const [resultImg, setResultImg] = useState<string | null>(null);
  
  const [clothPrompt, setClothPrompt] = useState("");
  const [isGeneratingCloth, setIsGeneratingCloth] = useState(false);
  const [isGeneratingTryOn, setIsGeneratingTryOn] = useState(false);
  
  const [generatedClothes, setGeneratedClothes] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleSelectPerson = async (url: string) => {
    try {
      // For external URLs, we display them immediately, but fetch base64 for API
      setPersonImg({ url, base64: null });
      const base64 = await urlToBase64(url);
      setPersonImg({ url, base64 });
      // Auto advance to next step for smoother UX
      setTimeout(() => setCurrentStep(1), 500);
    } catch (e) {
      console.error("Failed to load person image", e);
    }
  };

  const handleUploadPerson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);
      setPersonImg({ url, base64 });
      setCurrentStep(1);
    }
  };

  const handleSelectCloth = async (url: string) => {
    try {
      setClothImg({ url, base64: null });
      const base64 = await urlToBase64(url);
      setClothImg({ url, base64 });
    } catch (e) {
      console.error("Failed to load cloth image", e);
    }
  };

  const handleUploadCloth = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);
      setClothImg({ url, base64 });
    }
  };

  const handleGenerateCloth = async () => {
    if (!clothPrompt) return;
    setIsGeneratingCloth(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: `A high quality, flat-lay photography of: ${clothPrompt}. White background, clean lighting, full view of the garment.` }]
        },
      });

      // Process response to find image
      let foundImage = false;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64 = part.inlineData.data;
            const url = `data:image/png;base64,${base64}`;
            setGeneratedClothes(prev => [url, ...prev]);
            setClothImg({ url, base64 });
            foundImage = true;
            break;
          }
        }
      }
      
      if (!foundImage) {
          alert("AI 未能生成图片，请重试。");
      }

    } catch (error) {
      console.error(error);
      alert("生成服装失败，请检查网络或 Key。");
    } finally {
      setIsGeneratingCloth(false);
    }
  };

  const handleTryOn = async () => {
    if (!personImg.base64 || !clothImg.base64) {
      alert("请确保已选择人物和服装图片");
      return;
    }
    setIsGeneratingTryOn(true);
    setResultImg(null);
    setCurrentStep(2); // Move to result view

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Construct multimodal prompt
      const prompt = "Generate a photorealistic full-body image of the person in the first image wearing the clothing from the second image. Maintain the person's pose, body type, and facial features exactly. The clothing should fit naturally on the body. High quality, 4k.";
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: personImg.base64 } },
            { inlineData: { mimeType: 'image/jpeg', data: clothImg.base64 } },
            { text: prompt }
          ]
        }
      });

      let foundImage = false;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64 = part.inlineData.data;
            const url = `data:image/png;base64,${base64}`;
            setResultImg(url);
            setHistory(prev => [url, ...prev]);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
          alert("生成试穿效果失败。");
          setCurrentStep(1); // Go back
      }

    } catch (error) {
      console.error(error);
      alert("试穿生成失败，请稍后重试。");
      setCurrentStep(1);
    } finally {
      setIsGeneratingTryOn(false);
    }
  };

  // --- Render Helpers ---

  const renderStepIndicator = (step: number, label: string) => (
    <div 
      onClick={() => setCurrentStep(step)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all ${currentStep === step ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === step ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
        {step + 1}
      </div>
      <span className="font-medium">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              瑞米科技AI电商试衣间
            </h1>
          </div>
          <div className="flex gap-2">
             {renderStepIndicator(0, "选人")}
             <div className="w-8 flex items-center justify-center text-gray-300"><ArrowRight size={16}/></div>
             {renderStepIndicator(1, "选衣")}
             <div className="w-8 flex items-center justify-center text-gray-300"><ArrowRight size={16}/></div>
             {renderStepIndicator(2, "生成")}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 flex flex-col gap-8">
        
        {/* Visualizer Area */}
        <section className="perspective-container h-80 w-full flex justify-center items-center gap-4 py-4">
           <Card3D 
             title="模特" 
             image={personImg.url || null} 
             isActive={currentStep === 0} 
             rotateY={20} 
             rotateZ={-2}
             placeholderIcon={Camera}
             description="上传或选择人物"
           />
           <Card3D 
             title="服装" 
             image={clothImg.url || null} 
             isActive={currentStep === 1} 
             rotateY={0} 
             rotateZ={0}
             placeholderIcon={Shirt}
             description="上传或生成服装"
           />
           <Card3D 
             title="试穿效果" 
             image={resultImg} 
             isActive={currentStep === 2} 
             rotateY={-20} 
             rotateZ={2}
             placeholderIcon={Sparkles}
             description="AI 合成结果"
           />
        </section>

        {/* Interaction Area */}
        <section className="bg-white rounded-3xl shadow-xl border border-white/50 overflow-hidden min-h-[400px] flex flex-col relative">
            
            {/* Step 1: Person Selection */}
            {currentStep === 0 && (
              <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">第一步：选择模特</h2>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors font-medium"
                  >
                    <Upload size={18} />
                    上传图片
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleUploadPerson} 
                  />
                </div>
                
                <p className="text-gray-500 mb-4">预设人物</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {PRESET_PEOPLE.map((url, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleSelectPerson(url)}
                      className={`group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-4 transition-all ${personImg.url === url ? 'border-indigo-600 ring-4 ring-indigo-100' : 'border-transparent hover:border-gray-200'}`}
                    >
                      <img src={url} alt={`Person ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      {personImg.url === url && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Clothing Selection */}
            {currentStep === 1 && (
              <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">第二步：选择服装</h2>
                    {personImg.url && <p className="text-sm text-gray-400 mt-1">已选择模特，请搭配服装</p>}
                  </div>
                  
                  <div className="flex gap-3">
                     <button 
                      onClick={() => handleTryOn()}
                      disabled={!clothImg.url}
                      className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all shadow-md ${clothImg.url ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                      <Sparkles size={18} />
                      开始试穿
                    </button>
                  </div>
                </div>

                {/* AI Generation Input */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl mb-8 border border-indigo-100">
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={clothPrompt}
                      onChange={(e) => setClothPrompt(e.target.value)}
                      placeholder="描述你想生成的衣服，例如：'一件红色的丝绸晚礼服'..."
                      className="flex-1 bg-white border border-indigo-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button 
                      onClick={handleGenerateCloth}
                      disabled={isGeneratingCloth || !clothPrompt}
                      className="bg-indigo-600 text-white px-6 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap transition-all"
                    >
                      {isGeneratingCloth ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                      AI 生成
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-4">
                   <p className="text-gray-500">衣柜 / 预设</p>
                   <label className="text-sm text-indigo-600 cursor-pointer font-medium flex items-center gap-1 hover:text-indigo-800">
                      <Upload size={14}/> 上传衣服图片
                      <input type="file" className="hidden" accept="image/*" onChange={handleUploadCloth}/>
                   </label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 overflow-y-auto pb-4">
                  {/* Generated items first */}
                  {generatedClothes.map((url, idx) => (
                    <div 
                      key={`gen-${idx}`}
                      onClick={() => handleSelectCloth(url)}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-4 transition-all ${clothImg.url === url ? 'border-indigo-600 ring-4 ring-indigo-100' : 'border-transparent hover:border-gray-200'}`}
                    >
                      <img src={url} alt="Generated Cloth" className="w-full h-full object-cover bg-gray-100" />
                      <div className="absolute top-2 left-2 bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full">AI</div>
                    </div>
                  ))}
                  {/* Presets */}
                  {PRESET_CLOTHES.map((url, idx) => (
                    <div 
                      key={`pre-${idx}`}
                      onClick={() => handleSelectCloth(url)}
                      className={`group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-4 transition-all ${clothImg.url === url ? 'border-indigo-600 ring-4 ring-indigo-100' : 'border-transparent hover:border-gray-200'}`}
                    >
                      <img src={url} alt={`Cloth ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                       {clothImg.url === url && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

             {/* Step 3: Result */}
            {currentStep === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
                {isGeneratingTryOn ? (
                  <div className="flex flex-col items-center gap-4">
                     <div className="relative w-24 h-24">
                        <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                     </div>
                     <h3 className="text-xl font-medium text-slate-700 animate-pulse">Nano Banana 正在施展魔法...</h3>
                     <p className="text-gray-400 text-sm">正在分析体型并进行服装融合</p>
                  </div>
                ) : (
                  resultImg ? (
                    <div className="flex flex-col h-full w-full">
                       <div className="flex justify-between items-center mb-4">
                          <button onClick={() => setCurrentStep(1)} className="text-gray-500 hover:text-gray-800">← 返回调整</button>
                          <div className="flex gap-2">
                            <a href={resultImg} download="try-on-result.png" className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-slate-700 text-sm font-medium">
                                <Download size={16}/> 保存
                            </a>
                            <button onClick={handleTryOn} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 text-white text-sm font-medium shadow-lg shadow-indigo-200">
                                <RefreshCw size={16}/> 再试一次
                            </button>
                          </div>
                       </div>
                       <div className="flex-1 w-full flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden relative">
                          <img src={resultImg} className="max-h-full max-w-full object-contain shadow-2xl" alt="Result" />
                       </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <p>出现错误，请重试</p>
                      <button onClick={() => setCurrentStep(1)} className="mt-4 text-indigo-600 underline">返回</button>
                    </div>
                  )
                )}
              </div>
            )}

        </section>

        {/* Gallery Section */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <ImageIcon size={18} />
            <span className="font-medium uppercase tracking-wider text-xs">历史记录 Gallery</span>
          </div>
          {history.length === 0 ? (
             <div className="h-32 w-full border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-sm">
                暂无生成记录
             </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {history.map((img, i) => (
                <div key={i} className="snap-start shrink-0 w-32 h-48 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all border border-white cursor-pointer" onClick={() => {setResultImg(img); setCurrentStep(2);}}>
                  <img src={img} className="w-full h-full object-cover" alt={`History ${i}`} />
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<AIChangeClothesApp />);