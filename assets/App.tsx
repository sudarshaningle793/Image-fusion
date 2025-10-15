import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

// --- HELPER COMPONENTS (Defined outside main component) ---

const UploadIcon: React.FC = () => (
  <svg className="w-12 h-12 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
  </svg>
);

interface ImageUploaderProps {
  id: string;
  onImageChange: (file: File) => void;
  previewUrl: string | null;
  label: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ id, onImageChange, previewUrl, label }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onImageChange(event.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label htmlFor={id} className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        )}
        <input id={id} type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
      </label>
    </div>
  );
};


const Spinner: React.FC = () => (
  <div className="border-4 border-gray-500 border-t-blue-500 rounded-full w-16 h-16 animate-spin"></div>
);

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [image1, setImage1] = useState<{ base64: string; mimeType: string } | null>(null);
  const [image2, setImage2] = useState<{ base64: string; mimeType: string } | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('shaking hands');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileToGenerativePart = (file: { base64: string; mimeType: string }) => {
    return {
      inlineData: {
        data: file.base64,
        mimeType: file.mimeType,
      },
    };
  };

  const handleImageChange = async (file: File, setImageState: React.Dispatch<React.SetStateAction<{ base64: string; mimeType: string } | null>>) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageState({ base64: base64String, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to read image file.');
      console.error(err);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!image1 || !image2 || !selectedAction) {
      setError("Please upload both images and select an action.");
      return;
    }
    
    // Check for API Key
    if (!process.env.API_KEY) {
      setError("API_KEY environment variable not set. Please configure it to use the Gemini API.");
      return;
    }


    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const prompt = `From the two images provided, create a new photorealistic image where the person from the first image and the person from the second image are ${selectedAction}. The background should be neutral and the interaction between the two people should look natural and believable.`;

      const imagePart1 = fileToGenerativePart(image1);
      const imagePart2 = fileToGenerativePart(image2);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            imagePart1,
            imagePart2,
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      let generatedImageFound = false;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;
          const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
          setGeneratedImage(imageUrl);
          generatedImageFound = true;
          break;
        }
      }

      if (!generatedImageFound) {
        setError("The model did not return an image. Please try a different prompt or images.");
      }

    } catch (err: any) {
      setError(`An error occurred: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [image1, image2, selectedAction]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
            AI Image Fusion
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Merge two people into one scene. Upload two images, choose an interaction, and let Gemini create the magic.
          </p>
        </header>

        {/* Main Content */}
        <main>
          {/* Inputs Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-center text-gray-300">Person 1</h2>
              <ImageUploader 
                id="file-upload-1" 
                onImageChange={(file) => handleImageChange(file, setImage1)} 
                previewUrl={image1 ? `data:${image1.mimeType};base64,${image1.base64}` : null}
                label="First Person's Image"
              />
            </div>
            
            <div className="flex flex-col items-center space-y-6 md:mt-12">
              <div className="w-full">
                <label htmlFor="action-select" className="block mb-2 text-sm font-medium text-gray-300">Select an Action</label>
                <select 
                  id="action-select" 
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                >
                  <option value="shaking hands">Shake Hands</option>
                  <option value="hugging each other">Hug Each Other</option>
                  <option value="saluting each other">Salute Each Other</option>
                </select>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !image1 || !image2}
                className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-800 disabled:transform-none"
              >
                {isLoading ? 'Generating...' : 'Fuse Images'}
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-center text-gray-300">Person 2</h2>
              <ImageUploader 
                id="file-upload-2" 
                onImageChange={(file) => handleImageChange(file, setImage2)} 
                previewUrl={image2 ? `data:${image2.mimeType};base64,${image2.base64}` : null}
                label="Second Person's Image"
              />
            </div>
          </div>

          {/* Result Section */}
          <div className="mt-12">
            {isLoading && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg min-h-[30rem]">
                <Spinner />
                <p className="mt-4 text-lg text-gray-400">AI is thinking... this can take a moment.</p>
              </div>
            )}

            {error && (
              <div className="p-4 my-4 text-sm text-red-200 bg-red-900 bg-opacity-50 rounded-lg" role="alert">
                <span className="font-medium">Error:</span> {error}
              </div>
            )}

            {generatedImage && (
              <div className="bg-gray-800 p-4 rounded-lg shadow-2xl">
                <h2 className="text-2xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">Generated Result</h2>
                <img 
                  src={generatedImage} 
                  alt="Generated fusion" 
                  className="w-full max-w-2xl mx-auto rounded-lg" 
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;