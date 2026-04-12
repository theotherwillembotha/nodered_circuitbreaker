if ((window as any).ScriptEditorLanguageManager === undefined) {
  
class ScriptEditorLanguageManager {

    public static counter:number = 0;

    public static async createLanguage(monaco:any, template:string):Promise<ScriptEditorLanguage>{
        // generate a language name.
        let langName = "js_variant_" + ScriptEditorLanguageManager.counter;
        ScriptEditorLanguageManager.counter++;

        // Get the JavaScript language configuration
        let jsLangConfig = monaco.languages.getLanguages().find((lang:{ id:string }) => lang.id === 'javascript');

        let newLang = jsLangConfig.loader().then((implementation:{conf:any,language:any}) => {

            // Register your custom language
            monaco.languages.register({ id: langName });
            monaco.languages.setLanguageConfiguration(langName, implementation.conf);
            monaco.languages.setMonarchTokensProvider(langName, implementation.language);
            
            // Configure to allow top-level returns (function body context)
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: false,
                noSyntaxValidation: false,
                diagnosticCodesToIgnore: [1108] // Allow return outside function
            });
            
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ESNext,
                allowNonTsExtensions: true,
                allowJs: true,
                checkJs: true,
                noLib: false
            });
            
            // Debounced diagnostics update
            let diagnosticTimeout:NodeJS.Timeout;
            monaco.editor.onDidCreateModel((model:any) => {
                if (model.getLanguageId() === langName) {
                    updateDiagnostics(model);
                
                    model.onDidChangeContent(() => {
                        clearTimeout(diagnosticTimeout);
                        diagnosticTimeout = setTimeout(() => {
                        updateDiagnostics(model);
                        }, 500);
                    });
                }
            });

            function convertSeverity(category:number) {
                switch (category) {
                    case 1: return monaco.MarkerSeverity.Error;
                    case 0: return monaco.MarkerSeverity.Warning;
                    case 2: return monaco.MarkerSeverity.Info;
                    case 3: return monaco.MarkerSeverity.Hint;
                    default: return monaco.MarkerSeverity.Error;
                }
            }

            function flattenDiagnosticMessageText(messageText:any) {
                if (typeof messageText === 'string') {
                    return messageText;
                }
                
                let result = messageText.messageText;
                if (messageText.next) {
                    for (const child of messageText.next) {
                        result += '\n' + flattenDiagnosticMessageText(child);
                    }
                }
                return result;
            }


            function convertKind(tsKind:string) {
                const kindString = tsKind;
            
                // Map TypeScript ScriptElementKind to Monaco CompletionItemKind
                const kindMap:{[key:string]:number} = {
                    'method': monaco.languages.CompletionItemKind.Method,
                    'function': monaco.languages.CompletionItemKind.Function,
                    'constructor': monaco.languages.CompletionItemKind.Constructor,
                    'field': monaco.languages.CompletionItemKind.Field,
                    'variable': monaco.languages.CompletionItemKind.Variable,
                    'class': monaco.languages.CompletionItemKind.Class,
                    'interface': monaco.languages.CompletionItemKind.Interface,
                    'module': monaco.languages.CompletionItemKind.Module,
                    'property': monaco.languages.CompletionItemKind.Property,
                    'unit': monaco.languages.CompletionItemKind.Unit,
                    'value': monaco.languages.CompletionItemKind.Value,
                    'enum': monaco.languages.CompletionItemKind.Enum,
                    'keyword': monaco.languages.CompletionItemKind.Keyword,
                    'snippet': monaco.languages.CompletionItemKind.Snippet,
                    'text': monaco.languages.CompletionItemKind.Text,
                    'color': monaco.languages.CompletionItemKind.Color,
                    'file': monaco.languages.CompletionItemKind.File,
                    'reference': monaco.languages.CompletionItemKind.Reference,
                    'folder': monaco.languages.CompletionItemKind.Folder,
                    'enum member': monaco.languages.CompletionItemKind.EnumMember,
                    'constant': monaco.languages.CompletionItemKind.Constant,
                    'struct': monaco.languages.CompletionItemKind.Struct,
                    'event': monaco.languages.CompletionItemKind.Event,
                    'operator': monaco.languages.CompletionItemKind.Operator,
                    'type parameter': monaco.languages.CompletionItemKind.TypeParameter,
                    'var': monaco.languages.CompletionItemKind.Variable,
                    'const': monaco.languages.CompletionItemKind.Variable,
                    'let': monaco.languages.CompletionItemKind.Variable
                };
                
                return kindMap[kindString] || monaco.languages.CompletionItemKind.Property;
            }

            // Filter function with duplicate handling
            function filterBrowserAPIsWithDuplicateHandling(suggestions:any) {
                // Create a Set of "label:kind" strings for quick lookup
                const browserAPISet = new Set(
                    BROWSER_API_FILTER.map(api => `${api.label}:${api.kind}`)
                );
                
                // Count occurrences of each "label:kind" combination
                const occurrenceCounts = new Map();
                suggestions.forEach((s:any) => {
                    const key = `${s.label}:${s.kindString}`;
                    occurrenceCounts.set(key, (occurrenceCounts.get(key) || 0) + 1);
                });
                
                // Track how many of each browser API we've filtered
                const filteredCounts = new Map();
                
                // Filter suggestions
                const filtered = suggestions.filter((s:any) => {
                    const key = `${s.label}:${s.kindString}`;
                    
                    // If this is NOT a browser API, keep it
                    if (!browserAPISet.has(key)) {
                    return true;
                    }
                    
                    // It IS a browser API
                    const totalCount = occurrenceCounts.get(key) || 0;
                    const alreadyFiltered = filteredCounts.get(key) || 0;
                    
                    // If there are duplicates (user defined something with same name/kind)
                    if (totalCount > 1 && alreadyFiltered < totalCount - 1) {
                    // Filter this one (it's the browser API)
                    filteredCounts.set(key, alreadyFiltered + 1);
                    return false;
                    }
                    
                    // If it's the last one, keep it (it's the user-defined one)
                    if (totalCount > 1 && alreadyFiltered === totalCount - 1) {
                    return true;
                    }
                    
                    // No duplicates, filter the browser API
                    return false;
                });
                
                return filtered;
            }

            // Helper function to format documentation from TypeScript details
            function formatDocumentation(details:any) {
                let documentation = '';
                
                // Add the display parts (type signature)
                if (details.displayParts) {
                    documentation += details.displayParts.map((p:any) => p.text).join('');
                    documentation += '\n\n';
                }
                
                // Add JSDoc documentation
                if (details.documentation) {
                    documentation += details.documentation.map((d:any) => d.text).join('');
                }
                
                // Add JSDoc tags
                if (details.tags) {
                    details.tags.forEach((tag:any) => {
                        documentation += `\n\n@${tag.name}`;
                        if (tag.text) {
                            documentation += ' ' + tag.text.map((t:any) => t.text).join('');
                        }
                    });
                }
                
                return documentation;
            }
                
            // Update diagnostics function
            async function updateDiagnostics(model:any) {
                const script = model.getValue();
                
                // Wrap the user's code
                let wrappedCode = template.replace("${script}", script);
                
                // Create temporary JavaScript model with wrapped code
                const jsModel = monaco.editor.createModel(wrappedCode, 'javascript');
                
                try {
                    const getWorker = await monaco.languages.typescript.getJavaScriptWorker();
                    const client = await getWorker(jsModel.uri);
                    
                    const syntacticDiagnostics = await client.getSyntacticDiagnostics(jsModel.uri.toString());
                    const semanticDiagnostics = await client.getSemanticDiagnostics(jsModel.uri.toString());
                    
                    const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics];
                    
                    // Calculate where user code starts in wrapped version
                    const wrapperPrefix = wrappedCode.substring(0, wrappedCode.indexOf(script));
                    const wrapperOffset = wrapperPrefix.length;
                    
                    // Filter and adjust diagnostics to only show those in user's code
                    const markers = allDiagnostics
                        .filter(diagnostic => {
                            // Only include diagnostics within the user's code range
                            return diagnostic.start >= wrapperOffset && diagnostic.start < wrapperOffset + script.length;
                        })
                        .map(diagnostic => {
                            // Adjust positions to map back to the user's editor
                            const adjustedStart = diagnostic.start - wrapperOffset;
                            const adjustedEnd = adjustedStart + diagnostic.length;
                            
                            const start = model.getPositionAt(adjustedStart);
                            const end = model.getPositionAt(adjustedEnd);
                            
                            return {
                                severity: convertSeverity(diagnostic.category),
                                startLineNumber: start.lineNumber,
                                startColumn: start.column,
                                endLineNumber: end.lineNumber,
                                endColumn: end.column,
                                message: flattenDiagnosticMessageText(diagnostic.messageText),
                                code: diagnostic.code?.toString()
                            };
                        });
                    
                    monaco.editor.setModelMarkers(model, langName, markers);
                    
                }
                catch (error) {
                    console.error('Error getting diagnostics:', error);
                } 
                finally {
                    jsModel.dispose();
                }
            }
            
            // Register completion provider
            monaco.languages.registerCompletionItemProvider(langName, {triggerCharacters: ['.'], async provideCompletionItems(model:any, position:any) {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };
                
                const script = model.getValue();

                // Wrap the user's code
                let wrappedCode = template.replace("${script}", script);
                const wrapperPrefix = wrappedCode.substring(0, wrappedCode.indexOf(script));
                const userOffset = model.getOffsetAt(position);
                const wrappedOffset = wrapperPrefix.length + userOffset;
                const jsModel = monaco.editor.createModel(wrappedCode, 'javascript');
                
                try {
                    const getWorker = await monaco.languages.typescript.getJavaScriptWorker();
                    const client = await getWorker(jsModel.uri);
                    
                    const completions = await client.getCompletionsAtPosition(
                        jsModel.uri.toString(),
                        wrappedOffset
                    );

                    let jsCompletionSuggestions = [];
                    if (completions && completions.entries) {

                        const detailPromises = completions.entries.map(async (suggestion:any) => {

                            const details = await client.getCompletionEntryDetails(
                                jsModel.uri.toString(),
                                wrappedOffset,
                                suggestion.name
                            );

                            return {
                                label: suggestion.name,
                                kind: convertKind(suggestion.kind),
                                insertText: suggestion.name,
                                range: range,
                                sortText: suggestion.sortText,
                                kindString: suggestion.kind,
                                
                                // Add documentation from details
                                documentation: details 
                                    ? { value: formatDocumentation(details) } 
                                    : undefined,
                                detail: details?.displayParts 
                                    ? details.displayParts.map((p:any) => p.text).join('') 
                                    : undefined
                            };
                        });

                        const allSuggestions = await Promise.all(detailPromises);
                        jsCompletionSuggestions = filterBrowserAPIsWithDuplicateHandling(allSuggestions);
                    }

                    jsModel.dispose();
                    
                    // Add your custom suggestions
                    const customSuggestions:any[] = [
                    // {
                    //     label: 'myCustomFunction',
                    //     kind: monaco.languages.CompletionItemKind.Function,
                    //     insertText: 'myCustomFunction(${1:param})',
                    //     insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    //     documentation: 'My custom function',
                    //     range: range
                    // }
                    ];
                    
                    return {
                        suggestions: [...jsCompletionSuggestions, ...customSuggestions]
                    };
                } 
                catch (error) {
                    console.error('Error getting completions:', error);
                    jsModel.dispose();
                    return { suggestions: [] };
                }
            }});

            monaco.languages.registerHoverProvider(langName, { async provideHover(model:any, position:any) {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };
                
                const script = model.getValue();

                // Wrap the user's code
                let wrappedCode = template.replace("${script}", script);
                const wrapperPrefix = wrappedCode.substring(0, wrappedCode.indexOf(script));
                const userOffset = model.getOffsetAt(position);
                const wrappedOffset = wrapperPrefix.length + userOffset;
                const jsModel = monaco.editor.createModel(wrappedCode, 'javascript');

                try {
                    const getWorker = await monaco.languages.typescript.getJavaScriptWorker();
                    const client = await getWorker(jsModel.uri);
      
                    const quickInfo = await client.getQuickInfoAtPosition(
                        jsModel.uri.toString(),
                        wrappedOffset
                    );
      
                    jsModel.dispose();
                    
                    if (!quickInfo) {
                        return null;
                    }
      
                    // Format the hover content
                    let hoverContent = '';
                    
                    if (quickInfo.displayParts) {
                        hoverContent += '```typescript\n';
                        hoverContent += quickInfo.displayParts.map((p:any) => p.text).join('');
                        hoverContent += '\n```\n\n';
                    }
                    
                    if (quickInfo.documentation) {
                        hoverContent += quickInfo.documentation.map((d:any) => d.text).join('');
                    }
                    
                    if (quickInfo.tags) {
                        quickInfo.tags.forEach((tag:any) => {
                            hoverContent += `\n\n@${tag.name}`;
                            if (tag.text) {
                                hoverContent += ' ' + tag.text.map((t:any) => t.text).join('');
                            }
                        });
                    }
      
                    return {
                        contents: [
                            { value: hoverContent }
                        ]
                    };
                } 
                catch (error) {
                    console.error('Error getting hover info:', error);
                    jsModel.dispose();
                    return null;
                }
            }})
        });

        let language = new ScriptEditorLanguage(langName);
        return newLang.then(() => {
            console.log("Initialized Language: ", langName);
            return language;
        });
    }
}


class ScriptEditorLanguage {
    
    private name: string;

    constructor(name:string){
        this.name = name;
    }

    getName(){
        return this.name;
    }
}


// This is the exact list of browser/built-in APIs from a blank script
// Generated once and hardcoded here
const BROWSER_API_FILTER = [
    { label: "AbortController", kind: "var" },
    { label: "AbortSignal", kind: "var" },
    { label: "AbstractRange", kind: "var" },
    { label: "ActiveXObject", kind: "var" },
    { label: "addEventListener", kind: "function" },
    { label: "AggregateError", kind: "var" },
    { label: "alert", kind: "function" },
    { label: "AnalyserNode", kind: "var" },
    { label: "Animation", kind: "var" },
    { label: "AnimationEffect", kind: "var" },
    { label: "AnimationEvent", kind: "var" },
    { label: "AnimationPlaybackEvent", kind: "var" },
    { label: "AnimationTimeline", kind: "var" },
    { label: "Array", kind: "var" },
    { label: "ArrayBuffer", kind: "var" },
    { label: "atob", kind: "function" },
    { label: "Atomics", kind: "var" },
    { label: "Attr", kind: "var" },
    { label: "Audio", kind: "var" },
    { label: "AudioBuffer", kind: "var" },
    { label: "AudioBufferSourceNode", kind: "var" },
    { label: "AudioContext", kind: "var" },
    { label: "AudioDestinationNode", kind: "var" },
    { label: "AudioListener", kind: "var" },
    { label: "AudioNode", kind: "var" },
    { label: "AudioParam", kind: "var" },
    { label: "AudioParamMap", kind: "var" },
    { label: "AudioScheduledSourceNode", kind: "var" },
    { label: "AudioWorklet", kind: "var" },
    { label: "AudioWorkletNode", kind: "var" },
    { label: "AuthenticatorAssertionResponse", kind: "var" },
    { label: "AuthenticatorAttestationResponse", kind: "var" },
    { label: "AuthenticatorResponse", kind: "var" },
    { label: "BarProp", kind: "var" },
    { label: "BaseAudioContext", kind: "var" },
    { label: "BeforeUnloadEvent", kind: "var" },
    { label: "BigInt", kind: "var" },
    { label: "BigInt64Array", kind: "var" },
    { label: "BigUint64Array", kind: "var" },
    { label: "BiquadFilterNode", kind: "var" },
    { label: "Blob", kind: "var" },
    { label: "BlobEvent", kind: "var" },
    { label: "blur", kind: "function" },
    { label: "Boolean", kind: "var" },
    { label: "BroadcastChannel", kind: "var" },
    { label: "btoa", kind: "function" },
    { label: "ByteLengthQueuingStrategy", kind: "var" },
    { label: "Cache", kind: "var" },
    { label: "caches", kind: "var" },
    { label: "CacheStorage", kind: "var" },
    { label: "cancelAnimationFrame", kind: "function" },
    { label: "cancelIdleCallback", kind: "function" },
    { label: "CanvasCaptureMediaStreamTrack", kind: "var" },
    { label: "CanvasGradient", kind: "var" },
    { label: "CanvasPattern", kind: "var" },
    { label: "CanvasRenderingContext2D", kind: "var" },
    { label: "CDATASection", kind: "var" },
    { label: "ChannelMergerNode", kind: "var" },
    { label: "ChannelSplitterNode", kind: "var" },
    { label: "CharacterData", kind: "var" },
    { label: "clearInterval", kind: "function" },
    { label: "clearTimeout", kind: "function" },
    { label: "Clipboard", kind: "var" },
    { label: "ClipboardEvent", kind: "var" },
    { label: "ClipboardItem", kind: "var" },
    { label: "close", kind: "function" },
    { label: "closed", kind: "var" },
    { label: "CloseEvent", kind: "var" },
    { label: "Comment", kind: "var" },
    { label: "CompositionEvent", kind: "var" },
    { label: "confirm", kind: "function" },
    { label: "console", kind: "var" },
    { label: "ConstantSourceNode", kind: "var" },
    { label: "ConvolverNode", kind: "var" },
    { label: "CountQueuingStrategy", kind: "var" },
    { label: "createImageBitmap", kind: "function" },
    { label: "Credential", kind: "var" },
    { label: "CredentialsContainer", kind: "var" },
    { label: "crossOriginIsolated", kind: "var" },
    { label: "crypto", kind: "var" },
    { label: "Crypto", kind: "var" },
    { label: "CryptoKey", kind: "var" },
    { label: "CSS", kind: "module" },
    { label: "CSSAnimation", kind: "var" },
    { label: "CSSConditionRule", kind: "var" },
    { label: "CSSContainerRule", kind: "var" },
    { label: "CSSCounterStyleRule", kind: "var" },
    { label: "CSSFontFaceRule", kind: "var" },
    { label: "CSSFontFeatureValuesRule", kind: "var" },
    { label: "CSSFontPaletteValuesRule", kind: "var" },
    { label: "CSSGroupingRule", kind: "var" },
    { label: "CSSImportRule", kind: "var" },
    { label: "CSSKeyframeRule", kind: "var" },
    { label: "CSSKeyframesRule", kind: "var" },
    { label: "CSSLayerBlockRule", kind: "var" },
    { label: "CSSLayerStatementRule", kind: "var" },
    { label: "CSSMediaRule", kind: "var" },
    { label: "CSSNamespaceRule", kind: "var" },
    { label: "CSSPageRule", kind: "var" },
    { label: "CSSRule", kind: "var" },
    { label: "CSSRuleList", kind: "var" },
    { label: "CSSStyleDeclaration", kind: "var" },
    { label: "CSSStyleRule", kind: "var" },
    { label: "CSSStyleSheet", kind: "var" },
    { label: "CSSSupportsRule", kind: "var" },
    { label: "CSSTransition", kind: "var" },
    { label: "CustomElementRegistry", kind: "var" },
    { label: "customElements", kind: "var" },
    { label: "CustomEvent", kind: "var" },
    { label: "DataTransfer", kind: "var" },
    { label: "DataTransferItem", kind: "var" },
    { label: "DataTransferItemList", kind: "var" },
    { label: "DataView", kind: "var" },
    { label: "Date", kind: "var" },
    { label: "decodeURI", kind: "function" },
    { label: "decodeURIComponent", kind: "function" },
    { label: "DelayNode", kind: "var" },
    { label: "DeviceMotionEvent", kind: "var" },
    { label: "DeviceOrientationEvent", kind: "var" },
    { label: "devicePixelRatio", kind: "var" },
    { label: "dispatchEvent", kind: "function" },
    { label: "document", kind: "var" },
    { label: "Document", kind: "var" },
    { label: "DocumentFragment", kind: "var" },
    { label: "DocumentTimeline", kind: "var" },
    { label: "DocumentType", kind: "var" },
    { label: "DOMException", kind: "var" },
    { label: "DOMImplementation", kind: "var" },
    { label: "DOMMatrix", kind: "var" },
    { label: "DOMMatrixReadOnly", kind: "var" },
    { label: "DOMParser", kind: "var" },
    { label: "DOMPoint", kind: "var" },
    { label: "DOMPointReadOnly", kind: "var" },
    { label: "DOMQuad", kind: "var" },
    { label: "DOMRect", kind: "var" },
    { label: "DOMRectList", kind: "var" },
    { label: "DOMRectReadOnly", kind: "var" },
    { label: "DOMStringList", kind: "var" },
    { label: "DOMStringMap", kind: "var" },
    { label: "DOMTokenList", kind: "var" },
    { label: "DragEvent", kind: "var" },
    { label: "DynamicsCompressorNode", kind: "var" },
    { label: "Element", kind: "var" },
    { label: "ElementInternals", kind: "var" },
    { label: "encodeURI", kind: "function" },
    { label: "encodeURIComponent", kind: "function" },
    { label: "Enumerator", kind: "var" },
    { label: "Error", kind: "var" },
    { label: "ErrorEvent", kind: "var" },
    { label: "eval", kind: "function" },
    { label: "EvalError", kind: "var" },
    { label: "Event", kind: "var" },
    { label: "EventCounts", kind: "var" },
    { label: "EventSource", kind: "var" },
    { label: "EventTarget", kind: "var" },
    { label: "fetch", kind: "function" },
    { label: "File", kind: "var" },
    { label: "FileList", kind: "var" },
    { label: "FileReader", kind: "var" },
    { label: "FileSystem", kind: "var" },
    { label: "FileSystemDirectoryEntry", kind: "var" },
    { label: "FileSystemDirectoryHandle", kind: "var" },
    { label: "FileSystemDirectoryReader", kind: "var" },
    { label: "FileSystemEntry", kind: "var" },
    { label: "FileSystemFileEntry", kind: "var" },
    { label: "FileSystemFileHandle", kind: "var" },
    { label: "FileSystemHandle", kind: "var" },
    { label: "FinalizationRegistry", kind: "var" },
    { label: "Float32Array", kind: "var" },
    { label: "Float64Array", kind: "var" },
    { label: "focus", kind: "function" },
    { label: "FocusEvent", kind: "var" },
    { label: "FontFace", kind: "var" },
    { label: "FontFaceSet", kind: "var" },
    { label: "FontFaceSetLoadEvent", kind: "var" },
    { label: "FormData", kind: "var" },
    { label: "FormDataEvent", kind: "var" },
    { label: "frameElement", kind: "var" },
    { label: "frames", kind: "var" },
    { label: "Function", kind: "var" },
    { label: "GainNode", kind: "var" },
    { label: "Gamepad", kind: "var" },
    { label: "GamepadButton", kind: "var" },
    { label: "GamepadEvent", kind: "var" },
    { label: "GamepadHapticActuator", kind: "var" },
    { label: "Geolocation", kind: "var" },
    { label: "GeolocationCoordinates", kind: "var" },
    { label: "GeolocationPosition", kind: "var" },
    { label: "GeolocationPositionError", kind: "var" },
    { label: "getComputedStyle", kind: "function" },
    { label: "getSelection", kind: "function" },
    { label: "globalThis", kind: "module" },
    { label: "HashChangeEvent", kind: "var" },
    { label: "Headers", kind: "var" },
    { label: "history", kind: "var" },
    { label: "History", kind: "var" },
    { label: "HTMLAllCollection", kind: "var" },
    { label: "HTMLAnchorElement", kind: "var" },
    { label: "HTMLAreaElement", kind: "var" },
    { label: "HTMLAudioElement", kind: "var" },
    { label: "HTMLBaseElement", kind: "var" },
    { label: "HTMLBodyElement", kind: "var" },
    { label: "HTMLBRElement", kind: "var" },
    { label: "HTMLButtonElement", kind: "var" },
    { label: "HTMLCanvasElement", kind: "var" },
    { label: "HTMLCollection", kind: "var" },
    { label: "HTMLDataElement", kind: "var" },
    { label: "HTMLDataListElement", kind: "var" },
    { label: "HTMLDetailsElement", kind: "var" },
    { label: "HTMLDialogElement", kind: "var" },
    { label: "HTMLDivElement", kind: "var" },
    { label: "HTMLDListElement", kind: "var" },
    { label: "HTMLElement", kind: "var" },
    { label: "HTMLEmbedElement", kind: "var" },
    { label: "HTMLFieldSetElement", kind: "var" },
    { label: "HTMLFormControlsCollection", kind: "var" },
    { label: "HTMLFormElement", kind: "var" },
    { label: "HTMLHeadElement", kind: "var" },
    { label: "HTMLHeadingElement", kind: "var" },
    { label: "HTMLHRElement", kind: "var" },
    { label: "HTMLHtmlElement", kind: "var" },
    { label: "HTMLIFrameElement", kind: "var" },
    { label: "HTMLImageElement", kind: "var" },
    { label: "HTMLInputElement", kind: "var" },
    { label: "HTMLLabelElement", kind: "var" },
    { label: "HTMLLegendElement", kind: "var" },
    { label: "HTMLLIElement", kind: "var" },
    { label: "HTMLLinkElement", kind: "var" },
    { label: "HTMLMapElement", kind: "var" },
    { label: "HTMLMediaElement", kind: "var" },
    { label: "HTMLMenuElement", kind: "var" },
    { label: "HTMLMetaElement", kind: "var" },
    { label: "HTMLMeterElement", kind: "var" },
    { label: "HTMLModElement", kind: "var" },
    { label: "HTMLObjectElement", kind: "var" },
    { label: "HTMLOListElement", kind: "var" },
    { label: "HTMLOptGroupElement", kind: "var" },
    { label: "HTMLOptionElement", kind: "var" },
    { label: "HTMLOptionsCollection", kind: "var" },
    { label: "HTMLOutputElement", kind: "var" },
    { label: "HTMLParagraphElement", kind: "var" },
    { label: "HTMLPictureElement", kind: "var" },
    { label: "HTMLPreElement", kind: "var" },
    { label: "HTMLProgressElement", kind: "var" },
    { label: "HTMLQuoteElement", kind: "var" },
    { label: "HTMLScriptElement", kind: "var" },
    { label: "HTMLSelectElement", kind: "var" },
    { label: "HTMLSlotElement", kind: "var" },
    { label: "HTMLSourceElement", kind: "var" },
    { label: "HTMLSpanElement", kind: "var" },
    { label: "HTMLStyleElement", kind: "var" },
    { label: "HTMLTableCaptionElement", kind: "var" },
    { label: "HTMLTableCellElement", kind: "var" },
    { label: "HTMLTableColElement", kind: "var" },
    { label: "HTMLTableElement", kind: "var" },
    { label: "HTMLTableRowElement", kind: "var" },
    { label: "HTMLTableSectionElement", kind: "var" },
    { label: "HTMLTemplateElement", kind: "var" },
    { label: "HTMLTextAreaElement", kind: "var" },
    { label: "HTMLTimeElement", kind: "var" },
    { label: "HTMLTitleElement", kind: "var" },
    { label: "HTMLTrackElement", kind: "var" },
    { label: "HTMLUListElement", kind: "var" },
    { label: "HTMLUnknownElement", kind: "var" },
    { label: "HTMLVideoElement", kind: "var" },
    { label: "IDBCursor", kind: "var" },
    { label: "IDBCursorWithValue", kind: "var" },
    { label: "IDBDatabase", kind: "var" },
    { label: "IDBFactory", kind: "var" },
    { label: "IDBIndex", kind: "var" },
    { label: "IDBKeyRange", kind: "var" },
    { label: "IDBObjectStore", kind: "var" },
    { label: "IDBOpenDBRequest", kind: "var" },
    { label: "IDBRequest", kind: "var" },
    { label: "IDBTransaction", kind: "var" },
    { label: "IDBVersionChangeEvent", kind: "var" },
    { label: "IdleDeadline", kind: "var" },
    { label: "IIRFilterNode", kind: "var" },
    { label: "Image", kind: "var" },
    { label: "ImageBitmap", kind: "var" },
    { label: "ImageBitmapRenderingContext", kind: "var" },
    { label: "ImageData", kind: "var" },
    { label: "importScripts", kind: "function" },
    { label: "indexedDB", kind: "var" },
    { label: "Infinity", kind: "var" },
    { label: "innerHeight", kind: "var" },
    { label: "innerWidth", kind: "var" },
    { label: "InputDeviceInfo", kind: "var" },
    { label: "InputEvent", kind: "var" },
    { label: "Int16Array", kind: "var" },
    { label: "Int32Array", kind: "var" },
    { label: "Int8Array", kind: "var" },
    { label: "IntersectionObserver", kind: "var" },
    { label: "IntersectionObserverEntry", kind: "var" },
    { label: "Intl", kind: "module" },
    { label: "isFinite", kind: "function" },
    { label: "isNaN", kind: "function" },
    { label: "isSecureContext", kind: "var" },
    { label: "JSON", kind: "var" },
    { label: "KeyboardEvent", kind: "var" },
    { label: "KeyframeEffect", kind: "var" },
    { label: "length", kind: "var" },
    { label: "localStorage", kind: "var" },
    { label: "location", kind: "var" },
    { label: "Location", kind: "var" },
    { label: "locationbar", kind: "var" },
    { label: "Lock", kind: "var" },
    { label: "LockManager", kind: "var" },
    { label: "Map", kind: "var" },
    { label: "matchMedia", kind: "function" },
    { label: "Math", kind: "var" },
    { label: "MathMLElement", kind: "var" },
    { label: "MediaCapabilities", kind: "var" },
    { label: "MediaDeviceInfo", kind: "var" },
    { label: "MediaDevices", kind: "var" },
    { label: "MediaElementAudioSourceNode", kind: "var" },
    { label: "MediaEncryptedEvent", kind: "var" },
    { label: "MediaError", kind: "var" },
    { label: "MediaKeyMessageEvent", kind: "var" },
    { label: "MediaKeys", kind: "var" },
    { label: "MediaKeySession", kind: "var" },
    { label: "MediaKeyStatusMap", kind: "var" },
    { label: "MediaKeySystemAccess", kind: "var" },
    { label: "MediaList", kind: "var" },
    { label: "MediaMetadata", kind: "var" },
    { label: "MediaQueryList", kind: "var" },
    { label: "MediaQueryListEvent", kind: "var" },
    { label: "MediaRecorder", kind: "var" },
    { label: "MediaSession", kind: "var" },
    { label: "MediaSource", kind: "var" },
    { label: "MediaStream", kind: "var" },
    { label: "MediaStreamAudioDestinationNode", kind: "var" },
    { label: "MediaStreamAudioSourceNode", kind: "var" },
    { label: "MediaStreamTrack", kind: "var" },
    { label: "MediaStreamTrackEvent", kind: "var" },
    { label: "menubar", kind: "var" },
    { label: "MessageChannel", kind: "var" },
    { label: "MessageEvent", kind: "var" },
    { label: "MessagePort", kind: "var" },
    { label: "MIDIAccess", kind: "var" },
    { label: "MIDIConnectionEvent", kind: "var" },
    { label: "MIDIInput", kind: "var" },
    { label: "MIDIInputMap", kind: "var" },
    { label: "MIDIMessageEvent", kind: "var" },
    { label: "MIDIOutput", kind: "var" },
    { label: "MIDIOutputMap", kind: "var" },
    { label: "MIDIPort", kind: "var" },
    { label: "MimeTypeArray", kind: "var" },
    { label: "MouseEvent", kind: "var" },
    { label: "moveBy", kind: "function" },
    { label: "moveTo", kind: "function" },
    { label: "MutationObserver", kind: "var" },
    { label: "MutationRecord", kind: "var" },
    { label: "NamedNodeMap", kind: "var" },
    { label: "NaN", kind: "var" },
    { label: "NavigationPreloadManager", kind: "var" },
    { label: "navigator", kind: "var" },
    { label: "Navigator", kind: "var" },
    { label: "Node", kind: "var" },
    { label: "NodeFilter", kind: "var" },
    { label: "NodeIterator", kind: "var" },
    { label: "NodeList", kind: "var" },
    { label: "Notification", kind: "var" },
    { label: "Number", kind: "var" },
    { label: "Object", kind: "var" },
    { label: "OfflineAudioCompletionEvent", kind: "var" },
    { label: "OfflineAudioContext", kind: "var" },
    { label: "OffscreenCanvas", kind: "var" },
    { label: "OffscreenCanvasRenderingContext2D", kind: "var" },
    { label: "onabort", kind: "var" },
    { label: "onafterprint", kind: "var" },
    { label: "onanimationcancel", kind: "var" },
    { label: "onanimationend", kind: "var" },
    { label: "onanimationiteration", kind: "var" },
    { label: "onanimationstart", kind: "var" },
    { label: "onauxclick", kind: "var" },
    { label: "onbeforeinput", kind: "var" },
    { label: "onbeforeprint", kind: "var" },
    { label: "onbeforeunload", kind: "var" },
    { label: "onblur", kind: "var" },
    { label: "oncancel", kind: "var" },
    { label: "oncanplay", kind: "var" },
    { label: "oncanplaythrough", kind: "var" },
    { label: "onchange", kind: "var" },
    { label: "onclick", kind: "var" },
    { label: "onclose", kind: "var" },
    { label: "oncontextmenu", kind: "var" },
    { label: "oncopy", kind: "var" },
    { label: "oncuechange", kind: "var" },
    { label: "oncut", kind: "var" },
    { label: "ondblclick", kind: "var" },
    { label: "ondevicemotion", kind: "var" },
    { label: "ondeviceorientation", kind: "var" },
    { label: "ondrag", kind: "var" },
    { label: "ondragend", kind: "var" },
    { label: "ondragenter", kind: "var" },
    { label: "ondragleave", kind: "var" },
    { label: "ondragover", kind: "var" },
    { label: "ondragstart", kind: "var" },
    { label: "ondrop", kind: "var" },
    { label: "ondurationchange", kind: "var" },
    { label: "onemptied", kind: "var" },
    { label: "onended", kind: "var" },
    { label: "onerror", kind: "var" },
    { label: "onfocus", kind: "var" },
    { label: "onformdata", kind: "var" },
    { label: "ongamepadconnected", kind: "var" },
    { label: "ongamepaddisconnected", kind: "var" },
    { label: "ongotpointercapture", kind: "var" },
    { label: "onhashchange", kind: "var" },
    { label: "oninput", kind: "var" },
    { label: "oninvalid", kind: "var" },
    { label: "onkeydown", kind: "var" },
    { label: "onkeyup", kind: "var" },
    { label: "onlanguagechange", kind: "var" },
    { label: "onload", kind: "var" },
    { label: "onloadeddata", kind: "var" },
    { label: "onloadedmetadata", kind: "var" },
    { label: "onloadstart", kind: "var" },
    { label: "onlostpointercapture", kind: "var" },
    { label: "onmessage", kind: "var" },
    { label: "onmessageerror", kind: "var" },
    { label: "onmousedown", kind: "var" },
    { label: "onmouseenter", kind: "var" },
    { label: "onmouseleave", kind: "var" },
    { label: "onmousemove", kind: "var" },
    { label: "onmouseout", kind: "var" },
    { label: "onmouseover", kind: "var" },
    { label: "onmouseup", kind: "var" },
    { label: "onoffline", kind: "var" },
    { label: "ononline", kind: "var" },
    { label: "onpagehide", kind: "var" },
    { label: "onpageshow", kind: "var" },
    { label: "onpaste", kind: "var" },
    { label: "onpause", kind: "var" },
    { label: "onplay", kind: "var" },
    { label: "onplaying", kind: "var" },
    { label: "onpointercancel", kind: "var" },
    { label: "onpointerdown", kind: "var" },
    { label: "onpointerenter", kind: "var" },
    { label: "onpointerleave", kind: "var" },
    { label: "onpointermove", kind: "var" },
    { label: "onpointerout", kind: "var" },
    { label: "onpointerover", kind: "var" },
    { label: "onpointerup", kind: "var" },
    { label: "onpopstate", kind: "var" },
    { label: "onprogress", kind: "var" },
    { label: "onratechange", kind: "var" },
    { label: "onrejectionhandled", kind: "var" },
    { label: "onreset", kind: "var" },
    { label: "onresize", kind: "var" },
    { label: "onscroll", kind: "var" },
    { label: "onsecuritypolicyviolation", kind: "var" },
    { label: "onseeked", kind: "var" },
    { label: "onseeking", kind: "var" },
    { label: "onselect", kind: "var" },
    { label: "onselectionchange", kind: "var" },
    { label: "onselectstart", kind: "var" },
    { label: "onslotchange", kind: "var" },
    { label: "onstalled", kind: "var" },
    { label: "onstorage", kind: "var" },
    { label: "onsubmit", kind: "var" },
    { label: "onsuspend", kind: "var" },
    { label: "ontimeupdate", kind: "var" },
    { label: "ontoggle", kind: "var" },
    { label: "ontouchcancel", kind: "var" },
    { label: "ontouchend", kind: "var" },
    { label: "ontouchmove", kind: "var" },
    { label: "ontouchstart", kind: "var" },
    { label: "ontransitioncancel", kind: "var" },
    { label: "ontransitionend", kind: "var" },
    { label: "ontransitionrun", kind: "var" },
    { label: "ontransitionstart", kind: "var" },
    { label: "onunhandledrejection", kind: "var" },
    { label: "onunload", kind: "var" },
    { label: "onvolumechange", kind: "var" },
    { label: "onwaiting", kind: "var" },
    { label: "onwheel", kind: "var" },
    { label: "open", kind: "function" },
    { label: "opener", kind: "var" },
    { label: "Option", kind: "var" },
    { label: "origin", kind: "var" },
    { label: "OscillatorNode", kind: "var" },
    { label: "outerHeight", kind: "var" },
    { label: "outerWidth", kind: "var" },
    { label: "OverconstrainedError", kind: "var" },
    { label: "PageTransitionEvent", kind: "var" },
    { label: "PannerNode", kind: "var" },
    { label: "parent", kind: "var" },
    { label: "parseFloat", kind: "function" },
    { label: "parseInt", kind: "function" },
    { label: "Path2D", kind: "var" },
    { label: "PaymentMethodChangeEvent", kind: "var" },
    { label: "PaymentRequest", kind: "var" },
    { label: "PaymentRequestUpdateEvent", kind: "var" },
    { label: "PaymentResponse", kind: "var" },
    { label: "performance", kind: "var" },
    { label: "Performance", kind: "var" },
    { label: "PerformanceEntry", kind: "var" },
    { label: "PerformanceEventTiming", kind: "var" },
    { label: "PerformanceMark", kind: "var" },
    { label: "PerformanceMeasure", kind: "var" },
    { label: "PerformanceNavigationTiming", kind: "var" },
    { label: "PerformanceObserver", kind: "var" },
    { label: "PerformanceObserverEntryList", kind: "var" },
    { label: "PerformancePaintTiming", kind: "var" },
    { label: "PerformanceResourceTiming", kind: "var" },
    { label: "PerformanceServerTiming", kind: "var" },
    { label: "PeriodicWave", kind: "var" },
    { label: "Permissions", kind: "var" },
    { label: "PermissionStatus", kind: "var" },
    { label: "personalbar", kind: "var" },
    { label: "PictureInPictureEvent", kind: "var" },
    { label: "PictureInPictureWindow", kind: "var" },
    { label: "Plugin", kind: "var" },
    { label: "PluginArray", kind: "var" },
    { label: "PointerEvent", kind: "var" },
    { label: "PopStateEvent", kind: "var" },
    { label: "postMessage", kind: "function" },
    { label: "print", kind: "function" },
    { label: "ProcessingInstruction", kind: "var" },
    { label: "ProgressEvent", kind: "var" },
    { label: "Promise", kind: "var" },
    { label: "PromiseRejectionEvent", kind: "var" },
    { label: "prompt", kind: "function" },
    { label: "Proxy", kind: "var" },
    { label: "PublicKeyCredential", kind: "var" },
    { label: "PushManager", kind: "var" },
    { label: "PushSubscription", kind: "var" },
    { label: "PushSubscriptionOptions", kind: "var" },
    { label: "queueMicrotask", kind: "function" },
    { label: "RadioNodeList", kind: "var" },
    { label: "Range", kind: "var" },
    { label: "RangeError", kind: "var" },
    { label: "ReadableByteStreamController", kind: "var" },
    { label: "ReadableStream", kind: "var" },
    { label: "ReadableStreamBYOBReader", kind: "var" },
    { label: "ReadableStreamBYOBRequest", kind: "var" },
    { label: "ReadableStreamDefaultController", kind: "var" },
    { label: "ReadableStreamDefaultReader", kind: "var" },
    { label: "ReferenceError", kind: "var" },
    { label: "Reflect", kind: "module" },
    { label: "RegExp", kind: "var" },
    { label: "RemotePlayback", kind: "var" },
    { label: "removeEventListener", kind: "function" },
    { label: "reportError", kind: "function" },
    { label: "Request", kind: "var" },
    { label: "requestAnimationFrame", kind: "function" },
    { label: "requestIdleCallback", kind: "function" },
    { label: "resizeBy", kind: "function" },
    { label: "ResizeObserver", kind: "var" },
    { label: "ResizeObserverEntry", kind: "var" },
    { label: "ResizeObserverSize", kind: "var" },
    { label: "resizeTo", kind: "function" },
    { label: "Response", kind: "var" },
    { label: "RTCCertificate", kind: "var" },
    { label: "RTCDataChannel", kind: "var" },
    { label: "RTCDataChannelEvent", kind: "var" },
    { label: "RTCDtlsTransport", kind: "var" },
    { label: "RTCDTMFSender", kind: "var" },
    { label: "RTCDTMFToneChangeEvent", kind: "var" },
    { label: "RTCEncodedAudioFrame", kind: "var" },
    { label: "RTCEncodedVideoFrame", kind: "var" },
    { label: "RTCError", kind: "var" },
    { label: "RTCErrorEvent", kind: "var" },
    { label: "RTCIceCandidate", kind: "var" },
    { label: "RTCIceTransport", kind: "var" },
    { label: "RTCPeerConnection", kind: "var" },
    { label: "RTCPeerConnectionIceErrorEvent", kind: "var" },
    { label: "RTCPeerConnectionIceEvent", kind: "var" },
    { label: "RTCRtpReceiver", kind: "var" },
    { label: "RTCRtpSender", kind: "var" },
    { label: "RTCRtpTransceiver", kind: "var" },
    { label: "RTCSctpTransport", kind: "var" },
    { label: "RTCSessionDescription", kind: "var" },
    { label: "RTCStatsReport", kind: "var" },
    { label: "RTCTrackEvent", kind: "var" },
    { label: "SafeArray", kind: "class" },
    { label: "screen", kind: "var" },
    { label: "Screen", kind: "var" },
    { label: "screenLeft", kind: "var" },
    { label: "ScreenOrientation", kind: "var" },
    { label: "screenTop", kind: "var" },
    { label: "screenX", kind: "var" },
    { label: "screenY", kind: "var" },
    { label: "scroll", kind: "function" },
    { label: "scrollbars", kind: "var" },
    { label: "scrollBy", kind: "function" },
    { label: "scrollTo", kind: "function" },
    { label: "scrollX", kind: "var" },
    { label: "scrollY", kind: "var" },
    { label: "SecurityPolicyViolationEvent", kind: "var" },
    { label: "Selection", kind: "var" },
    { label: "self", kind: "var" },
    { label: "ServiceWorker", kind: "var" },
    { label: "ServiceWorkerContainer", kind: "var" },
    { label: "ServiceWorkerRegistration", kind: "var" },
    { label: "sessionStorage", kind: "var" },
    { label: "Set", kind: "var" },
    { label: "setInterval", kind: "function" },
    { label: "setTimeout", kind: "function" },
    { label: "ShadowRoot", kind: "var" },
    { label: "SharedArrayBuffer", kind: "var" },
    { label: "SharedWorker", kind: "var" },
    { label: "SourceBuffer", kind: "var" },
    { label: "SourceBufferList", kind: "var" },
    { label: "SpeechRecognitionAlternative", kind: "var" },
    { label: "SpeechRecognitionResult", kind: "var" },
    { label: "SpeechRecognitionResultList", kind: "var" },
    { label: "speechSynthesis", kind: "var" },
    { label: "SpeechSynthesis", kind: "var" },
    { label: "SpeechSynthesisErrorEvent", kind: "var" },
    { label: "SpeechSynthesisEvent", kind: "var" },
    { label: "SpeechSynthesisUtterance", kind: "var" },
    { label: "SpeechSynthesisVoice", kind: "var" },
    { label: "StaticRange", kind: "var" },
    { label: "statusbar", kind: "var" },
    { label: "StereoPannerNode", kind: "var" },
    { label: "stop", kind: "function" },
    { label: "Storage", kind: "var" },
    { label: "StorageEvent", kind: "var" },
    { label: "StorageManager", kind: "var" },
    { label: "String", kind: "var" },
    { label: "structuredClone", kind: "function" },
    { label: "StyleSheet", kind: "var" },
    { label: "StyleSheetList", kind: "var" },
    { label: "SubmitEvent", kind: "var" },
    { label: "SubtleCrypto", kind: "var" },
    { label: "SVGAElement", kind: "var" },
    { label: "SVGAngle", kind: "var" },
    { label: "SVGAnimatedAngle", kind: "var" },
    { label: "SVGAnimatedBoolean", kind: "var" },
    { label: "SVGAnimatedEnumeration", kind: "var" },
    { label: "SVGAnimatedInteger", kind: "var" },
    { label: "SVGAnimatedLength", kind: "var" },
    { label: "SVGAnimatedLengthList", kind: "var" },
    { label: "SVGAnimatedNumber", kind: "var" },
    { label: "SVGAnimatedNumberList", kind: "var" },
    { label: "SVGAnimatedPreserveAspectRatio", kind: "var" },
    { label: "SVGAnimatedRect", kind: "var" },
    { label: "SVGAnimatedString", kind: "var" },
    { label: "SVGAnimatedTransformList", kind: "var" },
    { label: "SVGAnimateElement", kind: "var" },
    { label: "SVGAnimateMotionElement", kind: "var" },
    { label: "SVGAnimateTransformElement", kind: "var" },
    { label: "SVGAnimationElement", kind: "var" },
    { label: "SVGCircleElement", kind: "var" },
    { label: "SVGClipPathElement", kind: "var" },
    { label: "SVGComponentTransferFunctionElement", kind: "var" },
    { label: "SVGDefsElement", kind: "var" },
    { label: "SVGDescElement", kind: "var" },
    { label: "SVGElement", kind: "var" },
    { label: "SVGEllipseElement", kind: "var" },
    { label: "SVGFEBlendElement", kind: "var" },
    { label: "SVGFEColorMatrixElement", kind: "var" },
    { label: "SVGFEComponentTransferElement", kind: "var" },
    { label: "SVGFECompositeElement", kind: "var" },
    { label: "SVGFEConvolveMatrixElement", kind: "var" },
    { label: "SVGFEDiffuseLightingElement", kind: "var" },
    { label: "SVGFEDisplacementMapElement", kind: "var" },
    { label: "SVGFEDistantLightElement", kind: "var" },
    { label: "SVGFEDropShadowElement", kind: "var" },
    { label: "SVGFEFloodElement", kind: "var" },
    { label: "SVGFEFuncAElement", kind: "var" },
    { label: "SVGFEFuncBElement", kind: "var" },
    { label: "SVGFEFuncGElement", kind: "var" },
    { label: "SVGFEFuncRElement", kind: "var" },
    { label: "SVGFEGaussianBlurElement", kind: "var" },
    { label: "SVGFEImageElement", kind: "var" },
    { label: "SVGFEMergeElement", kind: "var" },
    { label: "SVGFEMergeNodeElement", kind: "var" },
    { label: "SVGFEMorphologyElement", kind: "var" },
    { label: "SVGFEOffsetElement", kind: "var" },
    { label: "SVGFEPointLightElement", kind: "var" },
    { label: "SVGFESpecularLightingElement", kind: "var" },
    { label: "SVGFESpotLightElement", kind: "var" },
    { label: "SVGFETileElement", kind: "var" },
    { label: "SVGFETurbulenceElement", kind: "var" },
    { label: "SVGFilterElement", kind: "var" },
    { label: "SVGForeignObjectElement", kind: "var" },
    { label: "SVGGElement", kind: "var" },
    { label: "SVGGeometryElement", kind: "var" },
    { label: "SVGGradientElement", kind: "var" },
    { label: "SVGGraphicsElement", kind: "var" },
    { label: "SVGImageElement", kind: "var" },
    { label: "SVGLength", kind: "var" },
    { label: "SVGLengthList", kind: "var" },
    { label: "SVGLinearGradientElement", kind: "var" },
    { label: "SVGLineElement", kind: "var" },
    { label: "SVGMarkerElement", kind: "var" },
    { label: "SVGMaskElement", kind: "var" },
    { label: "SVGMatrix", kind: "var" },
    { label: "SVGMetadataElement", kind: "var" },
    { label: "SVGMPathElement", kind: "var" },
    { label: "SVGNumber", kind: "var" },
    { label: "SVGNumberList", kind: "var" },
    { label: "SVGPathElement", kind: "var" },
    { label: "SVGPatternElement", kind: "var" },
    { label: "SVGPoint", kind: "var" },
    { label: "SVGPointList", kind: "var" },
    { label: "SVGPolygonElement", kind: "var" },
    { label: "SVGPolylineElement", kind: "var" },
    { label: "SVGPreserveAspectRatio", kind: "var" },
    { label: "SVGRadialGradientElement", kind: "var" },
    { label: "SVGRect", kind: "var" },
    { label: "SVGRectElement", kind: "var" },
    { label: "SVGScriptElement", kind: "var" },
    { label: "SVGSetElement", kind: "var" },
    { label: "SVGStopElement", kind: "var" },
    { label: "SVGStringList", kind: "var" },
    { label: "SVGStyleElement", kind: "var" },
    { label: "SVGSVGElement", kind: "var" },
    { label: "SVGSwitchElement", kind: "var" },
    { label: "SVGSymbolElement", kind: "var" },
    { label: "SVGTextContentElement", kind: "var" },
    { label: "SVGTextElement", kind: "var" },
    { label: "SVGTextPathElement", kind: "var" },
    { label: "SVGTextPositioningElement", kind: "var" },
    { label: "SVGTitleElement", kind: "var" },
    { label: "SVGTransform", kind: "var" },
    { label: "SVGTransformList", kind: "var" },
    { label: "SVGTSpanElement", kind: "var" },
    { label: "SVGUnitTypes", kind: "var" },
    { label: "SVGUseElement", kind: "var" },
    { label: "SVGViewElement", kind: "var" },
    { label: "Symbol", kind: "var" },
    { label: "SyntaxError", kind: "var" },
    { label: "Text", kind: "var" },
    { label: "TextDecoder", kind: "var" },
    { label: "TextDecoderStream", kind: "var" },
    { label: "TextEncoder", kind: "var" },
    { label: "TextEncoderStream", kind: "var" },
    { label: "TextMetrics", kind: "var" },
    { label: "TextTrack", kind: "var" },
    { label: "TextTrackCue", kind: "var" },
    { label: "TextTrackCueList", kind: "var" },
    { label: "TextTrackList", kind: "var" },
    { label: "TimeRanges", kind: "var" },
    { label: "toolbar", kind: "var" },
    { label: "top", kind: "var" },
    { label: "toString", kind: "function" },
    { label: "Touch", kind: "var" },
    { label: "TouchEvent", kind: "var" },
    { label: "TouchList", kind: "var" },
    { label: "TrackEvent", kind: "var" },
    { label: "TransformStream", kind: "var" },
    { label: "TransformStreamDefaultController", kind: "var" },
    { label: "TransitionEvent", kind: "var" },
    { label: "TreeWalker", kind: "var" },
    { label: "TypeError", kind: "var" },
    { label: "UIEvent", kind: "var" },
    { label: "Uint16Array", kind: "var" },
    { label: "Uint32Array", kind: "var" },
    { label: "Uint8Array", kind: "var" },
    { label: "Uint8ClampedArray", kind: "var" },
    { label: "undefined", kind: "var" },
    { label: "URIError", kind: "var" },
    { label: "URL", kind: "var" },
    { label: "URLSearchParams", kind: "var" },
    { label: "ValidityState", kind: "var" },
    { label: "VarDate", kind: "class" },
    { label: "VBArray", kind: "var" },
    { label: "VideoColorSpace", kind: "var" },
    { label: "VideoPlaybackQuality", kind: "var" },
    { label: "visualViewport", kind: "var" },
    { label: "VisualViewport", kind: "var" },
    { label: "VTTCue", kind: "var" },
    { label: "VTTRegion", kind: "var" },
    { label: "WaveShaperNode", kind: "var" },
    { label: "WeakMap", kind: "var" },
    { label: "WeakRef", kind: "var" },
    { label: "WeakSet", kind: "var" },
    { label: "WebAssembly", kind: "module" },
    { label: "WebGL2RenderingContext", kind: "var" },
    { label: "WebGLActiveInfo", kind: "var" },
    { label: "WebGLBuffer", kind: "var" },
    { label: "WebGLContextEvent", kind: "var" },
    { label: "WebGLFramebuffer", kind: "var" },
    { label: "WebGLProgram", kind: "var" },
    { label: "WebGLQuery", kind: "var" },
    { label: "WebGLRenderbuffer", kind: "var" },
    { label: "WebGLRenderingContext", kind: "var" },
    { label: "WebGLSampler", kind: "var" },
    { label: "WebGLShader", kind: "var" },
    { label: "WebGLShaderPrecisionFormat", kind: "var" },
    { label: "WebGLSync", kind: "var" },
    { label: "WebGLTexture", kind: "var" },
    { label: "WebGLTransformFeedback", kind: "var" },
    { label: "WebGLUniformLocation", kind: "var" },
    { label: "WebGLVertexArrayObject", kind: "var" },
    { label: "WebKitCSSMatrix", kind: "var" },
    { label: "webkitURL", kind: "var" },
    { label: "WebSocket", kind: "var" },
    { label: "WheelEvent", kind: "var" },
    { label: "window", kind: "var" },
    { label: "Window", kind: "var" },
    { label: "Worker", kind: "var" },
    { label: "Worklet", kind: "var" },
    { label: "WritableStream", kind: "var" },
    { label: "WritableStreamDefaultController", kind: "var" },
    { label: "WritableStreamDefaultWriter", kind: "var" },
    { label: "WScript", kind: "var" },
    { label: "WSH", kind: "var" },
    { label: "XMLDocument", kind: "var" },
    { label: "XMLHttpRequest", kind: "var" },
    { label: "XMLHttpRequestEventTarget", kind: "var" },
    { label: "XMLHttpRequestUpload", kind: "var" },
    { label: "XMLSerializer", kind: "var" },
    { label: "XPathEvaluator", kind: "var" },
    { label: "XPathExpression", kind: "var" },
    { label: "XPathResult", kind: "var" },
    { label: "XSLTProcessor", kind: "var" },
    { label: "AudioProcessingEvent", kind: "var" },
    { label: "captureEvents", kind: "function" },
    { label: "clientInformation", kind: "var" },
    { label: "escape", kind: "function" },
    { label: "event", kind: "var" },
    { label: "external", kind: "var" },
    { label: "External", kind: "var" },
    { label: "HTMLDirectoryElement", kind: "var" },
    { label: "HTMLDocument", kind: "var" },
    { label: "HTMLFontElement", kind: "var" },
    { label: "HTMLFrameElement", kind: "var" },
    { label: "HTMLFrameSetElement", kind: "var" },
    { label: "HTMLMarqueeElement", kind: "var" },
    { label: "HTMLParamElement", kind: "var" },
    { label: "MimeType", kind: "var" },
    { label: "MutationEvent", kind: "var" },
    { label: "name", kind: "const" },
    { label: "onkeypress", kind: "var" },
    { label: "onorientationchange", kind: "var" },
    { label: "onwebkitanimationend", kind: "var" },
    { label: "onwebkitanimationiteration", kind: "var" },
    { label: "onwebkitanimationstart", kind: "var" },
    { label: "onwebkittransitionend", kind: "var" },
    { label: "orientation", kind: "var" },
    { label: "pageXOffset", kind: "var" },
    { label: "pageYOffset", kind: "var" },
    { label: "PerformanceNavigation", kind: "var" },
    { label: "PerformanceTiming", kind: "var" },
    { label: "releaseEvents", kind: "function" },
    { label: "ScriptProcessorNode", kind: "var" },
    { label: "status", kind: "var" },
    { label: "unescape", kind: "function" }
];

if(window){
    (window as any).ScriptEditorLanguageManager = ScriptEditorLanguageManager;
}

}