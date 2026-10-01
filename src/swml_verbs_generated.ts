// AUTO-GENERATED from porting-sdk/schema.json ($defs) — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-swml-verbs.ts
//
// The typed SWML verb CONFIG surface: one interface per schema.json $defs entry
// (object → interface; non-object → type alias) + the flattened <Verb>Config
// payload shapes. These are the config payloads the SwmlBuilder verb methods
// accept; the chainable verb METHODS live in SwmlVerbMethods.generated.ts. Open-
// shaped: every field optional and every named type carries a [key: string]:
// unknown tail so unmodeled server keys round-trip. Held to the same lint bar as
// hand-written source (no rule suppressions, no loose types).

export interface AI {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  ai?:
    | {
        /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
        SWAIG?:
          | {
              description?: string;
              active?: boolean | number | string;
              argument?: JsonSchemaUnion;
              data_map?: DataMap;
              fillers?: {
                default?: Record<string, unknown>;
                auto?: Record<string, unknown>;
              };
              function?: string;
              meta_data?: Record<string, unknown>;
              meta_data_token?: string;
              parameters?: JsonSchemaUnion;
              purpose?: string;
              skip_fillers?: boolean | string;
              wait_file?: string;
              wait_file_loops?: number | string;
              wait_for_fillers?: boolean | string;
              web_hook_auth_pass?: string;
              web_hook_auth_password?: string;
              web_hook_auth_user?: string;
              web_hook_url?: string;
            }[]
          | {
              defaults?: {
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              };
              functions?: {
                description?: string;
                active?: boolean | number | string;
                argument?: JsonSchemaUnion;
                data_map?: DataMap;
                fillers?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                function?: string;
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                parameters?: JsonSchemaUnion;
                purpose?: string;
                skip_fillers?: boolean | string;
                wait_file?: string;
                wait_file_loops?: number | string;
                wait_for_fillers?: boolean | string;
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              }[];
              hooks?: {
                description?: string;
                active?: boolean | number | string;
                argument?: JsonSchemaUnion;
                data_map?: DataMap;
                fillers?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                function?: string;
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                parameters?: JsonSchemaUnion;
                purpose?: string;
                skip_fillers?: boolean | string;
                wait_file?: string;
                wait_file_loops?: number | string;
                wait_for_fillers?: boolean | string;
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              }[];
              includes?: {
                auth_password?: string;
                auth_user?: string;
                functions?: unknown[];
                meta_data?: Record<string, unknown>;
                url?: string;
              }[];
              internal_fillers?: {
                adjust_response_latency?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                change_context?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                check_time?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                get_ideal_strategy?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                get_visual_input?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                next_step?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                pause_conversation?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                wait_for_user?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                wait_seconds?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
              };
              mcp_servers?: {
                headers?: Record<string, unknown>;
                resource_vars?: Record<string, unknown>;
                resources?: boolean | string;
                url?: string;
              }[];
              native_functions?: string[];
            };
        agent?: string | SWMLVar;
        /** The engine to use for the language. For example, 'elevenlabs'. */
        engine?: string | SWMLVar;
        /** A key-value object for storing data that persists throughout the AI session. */
        global_data?: Record<string, unknown>;
        /** Hints help the AI agent understand certain words or phrases better. Words that can commonly be misinterpreted can be added to the hints to help the AI speak more accurately. */
        hints?: (
          | {
              pattern?: string;
              hint?: string;
              ignore_case?: boolean | string;
              replace?: string;
            }
          | string
        )[];
        /** An array of JSON objects defining supported languages in the conversation. */
        languages?: {
          auto_emotion?: boolean | string;
          auto_speed?: boolean | string;
          code?: unknown[] | string;
          double_turn_fillers?: unknown[];
          engine?: string;
          fillers?: unknown[];
          function_fillers?: unknown[];
          listen_language?: unknown[] | string;
          model?: string;
          name?: string;
          params?: {
            emotion?: string;
            pitch?: number | string;
            similarity?: number | string;
            speakingRate?: number | string;
            speed?: number | string;
            stability?: number | string;
            streaming?: boolean | string;
            temperature?: number | string;
            vol?: number | string;
          };
          pronounce?: unknown[];
          speech_fillers?: unknown[];
          turn_fillers?: unknown[];
          voice?: string;
        }[];
        multilingual?: {
          allowed?: unknown[];
          engine?: string;
          fillers?:
            | unknown[]
            | {
                default?: Record<string, unknown>;
                auto?: Record<string, unknown>;
              };
          function_fillers?:
            | unknown[]
            | {
                default?: Record<string, unknown>;
                auto?: Record<string, unknown>;
              };
          languages?: unknown[];
          min_switch_words?: number;
          model?: string;
          provider?: string;
          start_language?: string;
          turn_fillers?:
            | unknown[]
            | {
                default?: Record<string, unknown>;
              };
        };
        /** An object of any necessary parameters for the API call. The key is the parameter name and the value is the parameter value. */
        params?: {
          acknowledge_interruptions?: number | string | boolean;
          acoustic_eot_gate_prob?: number | string;
          acoustic_eot_trust_prob?: number | string;
          ai_model?: string;
          ai_name?: string;
          ai_volume?: number | string;
          app_name?: string;
          asr_diarize?: boolean | number | string;
          asr_params?: Record<string, unknown>;
          asr_smart_format?: boolean | number | string;
          asr_speaker_affinity?: boolean | number | string;
          attention_escalate_prompt?: string;
          attention_timeout?: number | string;
          attention_timeout_prompt?: string;
          auth_token?: string;
          auto_correct?: boolean | number | string;
          azure_stream_first?: boolean | number | string;
          azure_tts_key?: string;
          background_file?: string;
          background_file_loops?: number | string;
          background_file_volume?: number | string;
          barge_functions?: boolean | number | string;
          barge_match_string?: string;
          barge_min_words?: number | string;
          bill_all_tts?: boolean | number | string;
          cache?: boolean | number | string;
          call_uuid?: string;
          cartesia_key?: string;
          cartesia_model?: string;
          cartesia_stream_first?: boolean | number | string;
          confidence?: number | string;
          conscience?: string;
          conversation_id?: string;
          conversation_sliding_window?: number | string;
          convo?: {
            content?: string;
            lang?: string;
            role?: string;
            tool_call_id?: string;
            tool_calls?: unknown[];
          }[];
          debug_webhook_level?: number | string;
          debug_webhook_url?: string;
          deepgram_key_override?: string;
          deepgram_stream_first?: boolean | number | string;
          deepgram_tts_key?: string;
          deepgram_url_override?: string;
          developer_prompt?: string;
          digit_terminators?: string;
          digit_timeout?: number | string;
          direction?: string;
          double_turn_filler_every_n?: number | string;
          double_turn_filler_min_ms?: number | string;
          double_turn_model?: string;
          double_turn_prompt?: string;
          double_turn_wait_ms?: number | string;
          double_turns?: boolean | string;
          eleven_labs_key?: string;
          eleven_labs_model?: string;
          eleven_labs_similarity?: number | string;
          eleven_labs_stability?: number | string;
          eleven_labs_stream_first?: boolean | number | string;
          enable_barge?: string | boolean;
          enable_inner_dialog?: boolean | string;
          enable_pause?: boolean | string;
          enable_text_normalization?: string;
          enable_thinking?: boolean | string;
          enable_turn_detection?: boolean | string;
          enable_vision?: boolean | string;
          end_of_speech_timeout?: number | string;
          energy_level?: number | string;
          escalate_after_ms?: number | string;
          escalate_after_turns?: number | string;
          event_webhook_url?: string;
          ext?: string;
          first_word_timeout?: number | string;
          fish_key?: string;
          fish_model?: string;
          function_filler_sequence_gap_ms?: number | string;
          function_wait_for_talking?: boolean | number | string;
          functions_on_no_response?: boolean | number | string;
          grok_key?: string;
          groq_tts_key?: string;
          hard_stop_prompt?: string;
          hard_stop_time?: string;
          hold_music?: string;
          hold_on_process?: boolean | number | string;
          inactivity_timeout?: number | string;
          initial_sleep_ms?: number | string;
          inner_dialog?: {
            SWAIG?: {
              defaults?: {
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              };
              functions?: unknown[];
            };
          };
          inner_dialog_model?: string;
          /** The default applies only when `enable_inner_dialog` / `inner_dialog_scorecard` enables it; otherwise the value stays unset. */
          inner_dialog_prompt?: string;
          inner_dialog_scorecard?:
            | boolean
            | {
                dials?: unknown[];
                replace?: boolean | string;
              };
          input_poll_freq?: number | string;
          interrupt_on_noise?: number | string | boolean;
          interrupt_prompt?: string;
          inworld_apikey?: string;
          inworld_key?: string;
          inworld_model?: string;
          language?: string;
          languages_enabled?: boolean | number | string;
          lipsync_debug?: boolean | number | string;
          llm_diarize_aware?: boolean | number | string;
          local_tz?: string;
          max_emotion?: number | string;
          max_response_tokens?: number | string;
          min_utterance_ms?: number | string;
          minimax_key?: string;
          minimax_model?: string;
          mistral_key?: string;
          mistral_model?: string;
          model?: string;
          openai_asr_engine?: string;
          openai_azure?: boolean | number | string;
          openai_gcloud_version?: string;
          openai_stream_first?: boolean | number | string;
          openai_tts_key?: string;
          openai_tts_url?: string;
          outbound_attention_timeout?: number | string;
          pcm_channels?: number | string;
          pcm_rate?: number | string;
          persist_global_data?: boolean | string;
          pom_format?: string;
          provider?: string;
          pvt_params?: string;
          realtime?: {
            input_transcription?: string;
            local_vad?: boolean | string;
            local_vad_frame_ms?: number | string;
            local_vad_threshold?: number | string;
            noise_reduction?: string;
            packets_per_send?: number | string;
            reasoning_effort?: string;
            speed?: number | string;
            temperature?: number | string;
            tool_model?: string;
            vad_eagerness?: string;
            vad_prefix_padding_ms?: number | string;
            vad_silence_duration_ms?: number | string;
            vad_threshold?: number | string;
            vad_type?: string;
            voice?: string;
          };
          redact_prompt?: string;
          rime_apikey?: string;
          rime_key?: string;
          rime_model?: string;
          rime_stream_first?: boolean | number | string;
          sample_rate?: number | string;
          save_conversation?: boolean | number | string;
          send_single_llm_response?: boolean | number | string;
          similarity?: number | string;
          smallest_key?: string;
          smallest_model?: string;
          speak_when_spoken_to?: boolean | string;
          speaker?: string;
          speech_event_timeout?: number | string;
          speech_gen_quick_stops?: number | string;
          speech_timeout?: number | string;
          speechify_key?: string;
          speechify_loudness_normalization?: boolean | number | string;
          speechify_model?: string;
          speechify_output_format?: string;
          speechify_stream_first?: boolean | number | string;
          speechify_text_normalization?: boolean | number | string;
          speed?: number | string;
          stability?: number | string;
          start_paused?: boolean | string;
          static_greeting?: string;
          static_greeting_no_barge?: boolean | number | string;
          stream_first?: boolean | number | string;
          streaming?: boolean | number | string;
          strict_mode?: string;
          summary_mode?: string;
          swaig_allow_settings?: boolean | number | string;
          swaig_allow_swml?: boolean | number | string;
          swaig_post_conversation?: boolean | number | string;
          swaig_post_swml_vars?: string[] | boolean | string;
          swaig_set_global_data?: boolean | number | string;
          target_first_segment_ms?: number | string;
          text_normalization_far_dir?: string;
          thinking_model?: string;
          tool_result_distill?:
            | boolean
            | {
                enabled?: boolean | string;
                min_chars?: number;
                model?: string;
                prompt?: string;
              };
          transfer_summary?: boolean | number | string;
          transparent_barge?: boolean | number | string;
          transparent_barge_max_time?: number | string;
          tts_number_format?: string;
          turn_detection?: boolean | string;
          turn_detection_min_length?: number | string;
          turn_detection_timeout?: number | string;
          turn_filler_every_n?: number | string;
          turn_filler_min_ms?: number | string;
          turn_filler_sources?: string;
          url?: string;
          utility_model?: string;
          vad_config?: string;
          video_fps?: number | string;
          video_idle_file?: string;
          video_listening_file?: string;
          video_scale?: string;
          video_talking_file?: string;
          vision_model?: string;
          voice_name?: string;
          vol?: number | string;
          wait_for_user?: boolean | number | string;
          wake_prefix?: string;
        };
        /** The final set of instructions and configuration settings to send to the agent. */
        post_prompt?: {
          frequency_penalty?: Record<string, unknown>;
          max_completion_tokens?: number;
          max_tokens?: number;
          model?: string;
          pom?: {
            title?: string;
            body?: string;
            bullets?: unknown[];
            numbered?: boolean;
            numberedBullets?: boolean;
            subsections?: unknown[];
          }[];
          presence_penalty?: Record<string, unknown>;
          reasoning_effort?: string;
          temperature?: number;
          text?: string;
          top_p?: number;
          verbosity?: string;
        };
        post_prompt_auth_password?: string | SWMLVar;
        post_prompt_auth_user?: string | SWMLVar;
        /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
        post_prompt_url?: string | SWMLVar;
        /** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
        prompt?: {
          contexts?: Record<string, Context>;
          frequency_penalty?: Record<string, unknown>;
          max_completion_tokens?: number;
          max_tokens?: number;
          model?: string;
          pom?: {
            title?: string;
            body?: string;
            bullets?: unknown[];
            numbered?: boolean;
            numberedBullets?: boolean;
            subsections?: unknown[];
          }[];
          presence_penalty?: Record<string, unknown>;
          reasoning_effort?: string;
          steps?: Step[];
          temperature?: number;
          text?: string;
          top_p?: number;
          verbosity?: string;
        };
        /** An array of JSON objects to clarify the AI's pronunciation of words or expressions. */
        pronounce?: {
          ignore_case?: boolean | number | string;
          replace?: string;
          with?: string;
        }[];
        /** Voice to use for the language. String format: `<engine id>.<voice id>`. */
        voice?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | {
              description?: string;
              active?: boolean | number | string;
              argument?: JsonSchemaUnion;
              data_map?: DataMap;
              fillers?: {
                default?: Record<string, unknown>;
                auto?: Record<string, unknown>;
              };
              function?: string;
              meta_data?: Record<string, unknown>;
              meta_data_token?: string;
              parameters?: JsonSchemaUnion;
              purpose?: string;
              skip_fillers?: boolean | string;
              wait_file?: string;
              wait_file_loops?: number | string;
              wait_for_fillers?: boolean | string;
              web_hook_auth_pass?: string;
              web_hook_auth_password?: string;
              web_hook_auth_user?: string;
              web_hook_url?: string;
            }[]
          | {
              defaults?: {
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              };
              functions?: {
                description?: string;
                active?: boolean | number | string;
                argument?: JsonSchemaUnion;
                data_map?: DataMap;
                fillers?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                function?: string;
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                parameters?: JsonSchemaUnion;
                purpose?: string;
                skip_fillers?: boolean | string;
                wait_file?: string;
                wait_file_loops?: number | string;
                wait_for_fillers?: boolean | string;
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              }[];
              hooks?: {
                description?: string;
                active?: boolean | number | string;
                argument?: JsonSchemaUnion;
                data_map?: DataMap;
                fillers?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                function?: string;
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                parameters?: JsonSchemaUnion;
                purpose?: string;
                skip_fillers?: boolean | string;
                wait_file?: string;
                wait_file_loops?: number | string;
                wait_for_fillers?: boolean | string;
                web_hook_auth_pass?: string;
                web_hook_auth_password?: string;
                web_hook_auth_user?: string;
                web_hook_url?: string;
              }[];
              includes?: {
                auth_password?: string;
                auth_user?: string;
                functions?: unknown[];
                meta_data?: Record<string, unknown>;
                url?: string;
              }[];
              internal_fillers?: {
                adjust_response_latency?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                change_context?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                check_time?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                get_ideal_strategy?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                get_visual_input?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                next_step?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                pause_conversation?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                wait_for_user?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
                wait_seconds?: {
                  default?: Record<string, unknown>;
                  auto?: Record<string, unknown>;
                };
              };
              mcp_servers?: {
                headers?: Record<string, unknown>;
                resource_vars?: Record<string, unknown>;
                resources?: boolean | string;
                url?: string;
              }[];
              native_functions?: string[];
            }
          | string
          | SWMLVar
          | (
              | {
                  pattern?: string;
                  hint?: string;
                  ignore_case?: boolean | string;
                  replace?: string;
                }
              | string
            )[]
          | {
              auto_emotion?: boolean | string;
              auto_speed?: boolean | string;
              code?: unknown[] | string;
              double_turn_fillers?: unknown[];
              engine?: string;
              fillers?: unknown[];
              function_fillers?: unknown[];
              listen_language?: unknown[] | string;
              model?: string;
              name?: string;
              params?: {
                emotion?: string;
                pitch?: number | string;
                similarity?: number | string;
                speakingRate?: number | string;
                speed?: number | string;
                stability?: number | string;
                streaming?: boolean | string;
                temperature?: number | string;
                vol?: number | string;
              };
              pronounce?: unknown[];
              speech_fillers?: unknown[];
              turn_fillers?: unknown[];
              voice?: string;
            }[]
          | {
              allowed?: unknown[];
              engine?: string;
              fillers?:
                | unknown[]
                | {
                    default?: Record<string, unknown>;
                    auto?: Record<string, unknown>;
                  };
              function_fillers?:
                | unknown[]
                | {
                    default?: Record<string, unknown>;
                    auto?: Record<string, unknown>;
                  };
              languages?: unknown[];
              min_switch_words?: number;
              model?: string;
              provider?: string;
              start_language?: string;
              turn_fillers?:
                | unknown[]
                | {
                    default?: Record<string, unknown>;
                  };
            }
          | {
              acknowledge_interruptions?: number | string | boolean;
              acoustic_eot_gate_prob?: number | string;
              acoustic_eot_trust_prob?: number | string;
              ai_model?: string;
              ai_name?: string;
              ai_volume?: number | string;
              app_name?: string;
              asr_diarize?: boolean | number | string;
              asr_params?: Record<string, unknown>;
              asr_smart_format?: boolean | number | string;
              asr_speaker_affinity?: boolean | number | string;
              attention_escalate_prompt?: string;
              attention_timeout?: number | string;
              attention_timeout_prompt?: string;
              auth_token?: string;
              auto_correct?: boolean | number | string;
              azure_stream_first?: boolean | number | string;
              azure_tts_key?: string;
              background_file?: string;
              background_file_loops?: number | string;
              background_file_volume?: number | string;
              barge_functions?: boolean | number | string;
              barge_match_string?: string;
              barge_min_words?: number | string;
              bill_all_tts?: boolean | number | string;
              cache?: boolean | number | string;
              call_uuid?: string;
              cartesia_key?: string;
              cartesia_model?: string;
              cartesia_stream_first?: boolean | number | string;
              confidence?: number | string;
              conscience?: string;
              conversation_id?: string;
              conversation_sliding_window?: number | string;
              convo?: {
                content?: string;
                lang?: string;
                role?: string;
                tool_call_id?: string;
                tool_calls?: unknown[];
              }[];
              debug_webhook_level?: number | string;
              debug_webhook_url?: string;
              deepgram_key_override?: string;
              deepgram_stream_first?: boolean | number | string;
              deepgram_tts_key?: string;
              deepgram_url_override?: string;
              developer_prompt?: string;
              digit_terminators?: string;
              digit_timeout?: number | string;
              direction?: string;
              double_turn_filler_every_n?: number | string;
              double_turn_filler_min_ms?: number | string;
              double_turn_model?: string;
              double_turn_prompt?: string;
              double_turn_wait_ms?: number | string;
              double_turns?: boolean | string;
              eleven_labs_key?: string;
              eleven_labs_model?: string;
              eleven_labs_similarity?: number | string;
              eleven_labs_stability?: number | string;
              eleven_labs_stream_first?: boolean | number | string;
              enable_barge?: string | boolean;
              enable_inner_dialog?: boolean | string;
              enable_pause?: boolean | string;
              enable_text_normalization?: string;
              enable_thinking?: boolean | string;
              enable_turn_detection?: boolean | string;
              enable_vision?: boolean | string;
              end_of_speech_timeout?: number | string;
              energy_level?: number | string;
              escalate_after_ms?: number | string;
              escalate_after_turns?: number | string;
              event_webhook_url?: string;
              ext?: string;
              first_word_timeout?: number | string;
              fish_key?: string;
              fish_model?: string;
              function_filler_sequence_gap_ms?: number | string;
              function_wait_for_talking?: boolean | number | string;
              functions_on_no_response?: boolean | number | string;
              grok_key?: string;
              groq_tts_key?: string;
              hard_stop_prompt?: string;
              hard_stop_time?: string;
              hold_music?: string;
              hold_on_process?: boolean | number | string;
              inactivity_timeout?: number | string;
              initial_sleep_ms?: number | string;
              inner_dialog?: {
                SWAIG?: {
                  defaults?: {
                    web_hook_auth_pass?: string;
                    web_hook_auth_password?: string;
                    web_hook_auth_user?: string;
                    web_hook_url?: string;
                  };
                  functions?: unknown[];
                };
              };
              inner_dialog_model?: string;
              /** The default applies only when `enable_inner_dialog` / `inner_dialog_scorecard` enables it; otherwise the value stays unset. */
              inner_dialog_prompt?: string;
              inner_dialog_scorecard?:
                | boolean
                | {
                    dials?: unknown[];
                    replace?: boolean | string;
                  };
              input_poll_freq?: number | string;
              interrupt_on_noise?: number | string | boolean;
              interrupt_prompt?: string;
              inworld_apikey?: string;
              inworld_key?: string;
              inworld_model?: string;
              language?: string;
              languages_enabled?: boolean | number | string;
              lipsync_debug?: boolean | number | string;
              llm_diarize_aware?: boolean | number | string;
              local_tz?: string;
              max_emotion?: number | string;
              max_response_tokens?: number | string;
              min_utterance_ms?: number | string;
              minimax_key?: string;
              minimax_model?: string;
              mistral_key?: string;
              mistral_model?: string;
              model?: string;
              openai_asr_engine?: string;
              openai_azure?: boolean | number | string;
              openai_gcloud_version?: string;
              openai_stream_first?: boolean | number | string;
              openai_tts_key?: string;
              openai_tts_url?: string;
              outbound_attention_timeout?: number | string;
              pcm_channels?: number | string;
              pcm_rate?: number | string;
              persist_global_data?: boolean | string;
              pom_format?: string;
              provider?: string;
              pvt_params?: string;
              realtime?: {
                input_transcription?: string;
                local_vad?: boolean | string;
                local_vad_frame_ms?: number | string;
                local_vad_threshold?: number | string;
                noise_reduction?: string;
                packets_per_send?: number | string;
                reasoning_effort?: string;
                speed?: number | string;
                temperature?: number | string;
                tool_model?: string;
                vad_eagerness?: string;
                vad_prefix_padding_ms?: number | string;
                vad_silence_duration_ms?: number | string;
                vad_threshold?: number | string;
                vad_type?: string;
                voice?: string;
              };
              redact_prompt?: string;
              rime_apikey?: string;
              rime_key?: string;
              rime_model?: string;
              rime_stream_first?: boolean | number | string;
              sample_rate?: number | string;
              save_conversation?: boolean | number | string;
              send_single_llm_response?: boolean | number | string;
              similarity?: number | string;
              smallest_key?: string;
              smallest_model?: string;
              speak_when_spoken_to?: boolean | string;
              speaker?: string;
              speech_event_timeout?: number | string;
              speech_gen_quick_stops?: number | string;
              speech_timeout?: number | string;
              speechify_key?: string;
              speechify_loudness_normalization?: boolean | number | string;
              speechify_model?: string;
              speechify_output_format?: string;
              speechify_stream_first?: boolean | number | string;
              speechify_text_normalization?: boolean | number | string;
              speed?: number | string;
              stability?: number | string;
              start_paused?: boolean | string;
              static_greeting?: string;
              static_greeting_no_barge?: boolean | number | string;
              stream_first?: boolean | number | string;
              streaming?: boolean | number | string;
              strict_mode?: string;
              summary_mode?: string;
              swaig_allow_settings?: boolean | number | string;
              swaig_allow_swml?: boolean | number | string;
              swaig_post_conversation?: boolean | number | string;
              swaig_post_swml_vars?: string[] | boolean | string;
              swaig_set_global_data?: boolean | number | string;
              target_first_segment_ms?: number | string;
              text_normalization_far_dir?: string;
              thinking_model?: string;
              tool_result_distill?:
                | boolean
                | {
                    enabled?: boolean | string;
                    min_chars?: number;
                    model?: string;
                    prompt?: string;
                  };
              transfer_summary?: boolean | number | string;
              transparent_barge?: boolean | number | string;
              transparent_barge_max_time?: number | string;
              tts_number_format?: string;
              turn_detection?: boolean | string;
              turn_detection_min_length?: number | string;
              turn_detection_timeout?: number | string;
              turn_filler_every_n?: number | string;
              turn_filler_min_ms?: number | string;
              turn_filler_sources?: string;
              url?: string;
              utility_model?: string;
              vad_config?: string;
              video_fps?: number | string;
              video_idle_file?: string;
              video_listening_file?: string;
              video_scale?: string;
              video_talking_file?: string;
              vision_model?: string;
              voice_name?: string;
              vol?: number | string;
              wait_for_user?: boolean | number | string;
              wake_prefix?: string;
            }
          | {
              frequency_penalty?: Record<string, unknown>;
              max_completion_tokens?: number;
              max_tokens?: number;
              model?: string;
              pom?: {
                title?: string;
                body?: string;
                bullets?: unknown[];
                numbered?: boolean;
                numberedBullets?: boolean;
                subsections?: unknown[];
              }[];
              presence_penalty?: Record<string, unknown>;
              reasoning_effort?: string;
              temperature?: number;
              text?: string;
              top_p?: number;
              verbosity?: string;
            }
          | {
              contexts?: Record<string, Context>;
              frequency_penalty?: Record<string, unknown>;
              max_completion_tokens?: number;
              max_tokens?: number;
              model?: string;
              pom?: {
                title?: string;
                body?: string;
                bullets?: unknown[];
                numbered?: boolean;
                numberedBullets?: boolean;
                subsections?: unknown[];
              }[];
              presence_penalty?: Record<string, unknown>;
              reasoning_effort?: string;
              steps?: Step[];
              temperature?: number;
              text?: string;
              top_p?: number;
              verbosity?: string;
            }
          | {
              ignore_case?: boolean | number | string;
              replace?: string;
              with?: string;
            }[]
          | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface AiSidecar {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  ai_sidecar?:
    | {
        /** SWAIG functions and MCP servers available to the sidecar. */
        SWAIG?:
          | {
              defaults?:
                | {
                    web_hook_auth_pass?: string | SWMLVar;
                    web_hook_auth_password?: string | SWMLVar;
                    web_hook_auth_user?: string | SWMLVar;
                    web_hook_url?: string | SWMLVar;
                  }
                | SWMLVar;
              functions?:
                | (
                    | {
                        description?: string | SWMLVar;
                        function?: string | SWMLVar;
                        parameters?: JsonSchemaUnion | SWMLVar;
                        purpose?: string | SWMLVar;
                        web_hook_auth_pass?: string | SWMLVar;
                        web_hook_auth_password?: string | SWMLVar;
                        web_hook_auth_user?: string | SWMLVar;
                        web_hook_url?: string | SWMLVar;
                      }
                    | SWMLVar
                  )[]
                | SWMLVar;
              mcp_servers?: unknown[] | SWMLVar;
            }
          | SWMLVar;
        /** Summarize the conversation instead of starting a sidecar. When you include `action.summarize`, */
        action?: Record<string, unknown> | SWMLVar;
        /** Which leg is the customer, used as the turn-end trigger source. **Default:** `remote-caller`. */
        customer_role?: string | SWMLVar;
        /** The call legs to observe. Both legs are required — a single-leg value is rejected. When omitted, both legs are observed. **Default:** both legs (`remote-caller` and `local-caller`). */
        direction?: (string | SWMLVar)[] | SWMLVar;
        /** A key-value object of data that is available throughout the sidecar session. You can reference it in the prompt with variable expansion, and it is included in the requests sent to your tools. */
        global_data?: Record<string, unknown> | SWMLVar;
        /** Hints that improve speech recognition of specific terms, such as product names, competitor names, jargon, or customer names. Strongly recommended. */
        hints?: (string | SWMLVar)[] | SWMLVar;
        /** The conversation language as a single BCP-47 tag. Sets the speech recognition language and is shared with the model as a hint. */
        lang?: string | SWMLVar;
        /** The model used for the sidecar's advice and its end-of-call summaries. Suggested values: `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1-nano`. **Default:** `gpt-4o-mini`. */
        model?: string | SWMLVar;
        /** Tuning options for the sidecar. */
        params?:
          | {
              act_on_channel?: boolean | SWMLVar;
              ai_summary?: boolean | SWMLVar;
              ai_summary_prompt?: string | SWMLVar;
              debug?: boolean | SWMLVar;
              debug_level?: number | SWMLVar;
              deepgram_key_override?: string | SWMLVar;
              deepgram_url_override?: string | SWMLVar;
              final_summary?: boolean | SWMLVar;
              idle_timeout_ms?: number | SWMLVar;
              live_events?: boolean | SWMLVar;
              max_history_tokens?: number | SWMLVar;
              max_iters_per_tick?: number | SWMLVar;
              min_interval_ms?: number | SWMLVar;
              speech_engine?: string | SWMLVar;
              speech_timeout?: number | SWMLVar;
              summary_model?: string | SWMLVar;
              transcribe_prompt?: string | SWMLVar;
              vad_silence_ms?: number | SWMLVar;
              vad_thresh?: number | SWMLVar;
              verbose_utterances?: boolean | SWMLVar;
            }
          | SWMLVar;
        /** SWAIG permission overrides. Defaults to all permissions enabled. */
        permissions?:
          | {
              swaig_allow_settings?: boolean | SWMLVar;
              swaig_allow_swml?: boolean | SWMLVar;
              swaig_set_global_data?: boolean | SWMLVar;
            }
          | SWMLVar;
        /** The prompt used to write the summary. May be given as a string, or as an object with a `file` key naming a file to read it from. Defaults to `Be helpful.` */
        prompt?:
          | {
              file?: string | SWMLVar;
            }
          | string
          | SWMLVar;
        /** The webhook URL the sidecar POSTs its callbacks to. Receives both transcription events and sidecar callbacks. */
        url?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | {
              defaults?:
                | {
                    web_hook_auth_pass?: string | SWMLVar;
                    web_hook_auth_password?: string | SWMLVar;
                    web_hook_auth_user?: string | SWMLVar;
                    web_hook_url?: string | SWMLVar;
                  }
                | SWMLVar;
              functions?:
                | (
                    | {
                        description?: string | SWMLVar;
                        function?: string | SWMLVar;
                        parameters?: JsonSchemaUnion | SWMLVar;
                        purpose?: string | SWMLVar;
                        web_hook_auth_pass?: string | SWMLVar;
                        web_hook_auth_password?: string | SWMLVar;
                        web_hook_auth_user?: string | SWMLVar;
                        web_hook_url?: string | SWMLVar;
                      }
                    | SWMLVar
                  )[]
                | SWMLVar;
              mcp_servers?: unknown[] | SWMLVar;
            }
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | string
          | SWMLVar
          | (string | SWMLVar)[]
          | SWMLVar
          | {
              act_on_channel?: boolean | SWMLVar;
              ai_summary?: boolean | SWMLVar;
              ai_summary_prompt?: string | SWMLVar;
              debug?: boolean | SWMLVar;
              debug_level?: number | SWMLVar;
              deepgram_key_override?: string | SWMLVar;
              deepgram_url_override?: string | SWMLVar;
              final_summary?: boolean | SWMLVar;
              idle_timeout_ms?: number | SWMLVar;
              live_events?: boolean | SWMLVar;
              max_history_tokens?: number | SWMLVar;
              max_iters_per_tick?: number | SWMLVar;
              min_interval_ms?: number | SWMLVar;
              speech_engine?: string | SWMLVar;
              speech_timeout?: number | SWMLVar;
              summary_model?: string | SWMLVar;
              transcribe_prompt?: string | SWMLVar;
              vad_silence_ms?: number | SWMLVar;
              vad_thresh?: number | SWMLVar;
              verbose_utterances?: boolean | SWMLVar;
            }
          | SWMLVar
          | {
              swaig_allow_settings?: boolean | SWMLVar;
              swaig_allow_swml?: boolean | SWMLVar;
              swaig_set_global_data?: boolean | SWMLVar;
            }
          | SWMLVar
          | {
              file?: string | SWMLVar;
            }
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface AmazonBedrock {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  amazon_bedrock?:
    | {
        /** An object holding the user-defined functions/endpoints that can be executed during the dialogue. The engine reads two keys off it: `functions`, the array of function definitions, and `defaults`, an object of settings applied to each of them. */
        SWAIG?: {
          defaults?: {
            web_hook_url?: string;
          };
          functions?: {
            description?: string;
            data_map?: DataMap;
            function?: string;
            meta_data?: Record<string, unknown>;
            meta_data_token?: string;
            parameters?: JsonSchema;
            web_hook_url?: string;
          }[];
        };
        app_name?: string;
        assistant_name?: string;
        assistant_prompt?: string;
        conversation_id?: string;
        /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script */
        global_data?: Record<string, unknown>;
        greeting_prompt?: {
          role?: string;
          text?: string;
        };
        /** A JSON object containing parameters as key-value pairs. */
        params?: {
          /** Effective range 1000..60000 (0 is also accepted). A value outside it is ignored by the engine rather than rejected. */
          attention_timeout?: number | string;
          compact_conversation_time?: string;
          compact_strategy?: string;
          /** The default applies only when `hard_stop_time` enables it; otherwise the value stays unset. */
          hard_stop_prompt?: string;
          hard_stop_time?: string;
          /** Effective range 10000..3600000 (0 is also accepted). A value outside it is ignored by the engine rather than rejected. */
          inactivity_timeout?: number | string;
          video_idle_file?: string;
          video_listening_file?: string;
          video_talking_file?: string;
        };
        /** The final set of instructions and configuration settings to send to the agent. */
        post_prompt?: {
          pom?: {
            title?: string;
            body?: string;
            bullets?: unknown[];
            numbered?: boolean;
            numberedBullets?: boolean;
            subsections?: unknown[];
          }[];
          text?: string;
        };
        /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
        post_prompt_url?: string;
        /** Establishes the initial set of instructions and settings to configure the agent. */
        prompt?: {
          pom?: {
            title?: string;
            body?: string;
            bullets?: unknown[];
            numbered?: boolean;
            numberedBullets?: boolean;
            subsections?: unknown[];
          }[];
          temperature?: number | string;
          text?: string;
          top_p?: number | string;
          voice_id?: string;
        };
        transcript_webhook_url?: string;
        [key: string]:
          | Record<string, unknown>
          | {
              defaults?: {
                web_hook_url?: string;
              };
              functions?: {
                description?: string;
                data_map?: DataMap;
                function?: string;
                meta_data?: Record<string, unknown>;
                meta_data_token?: string;
                parameters?: JsonSchema;
                web_hook_url?: string;
              }[];
            }
          | string
          | {
              role?: string;
              text?: string;
            }
          | {
              /** Effective range 1000..60000 (0 is also accepted). A value outside it is ignored by the engine rather than rejected. */
              attention_timeout?: number | string;
              compact_conversation_time?: string;
              compact_strategy?: string;
              /** The default applies only when `hard_stop_time` enables it; otherwise the value stays unset. */
              hard_stop_prompt?: string;
              hard_stop_time?: string;
              /** Effective range 10000..3600000 (0 is also accepted). A value outside it is ignored by the engine rather than rejected. */
              inactivity_timeout?: number | string;
              video_idle_file?: string;
              video_listening_file?: string;
              video_talking_file?: string;
            }
          | {
              pom?: {
                title?: string;
                body?: string;
                bullets?: unknown[];
                numbered?: boolean;
                numberedBullets?: boolean;
                subsections?: unknown[];
              }[];
              text?: string;
            }
          | {
              pom?: {
                title?: string;
                body?: string;
                bullets?: unknown[];
                numbered?: boolean;
                numberedBullets?: boolean;
                subsections?: unknown[];
              }[];
              temperature?: number | string;
              text?: string;
              top_p?: number | string;
              voice_id?: string;
            }
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Answer {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  answer?:
    | {
        /** Comma-separated string of codecs to offer. Valid codecs are: PCMU, PCMA, G722, G729, AMR-WB, OPUS, VP8, H264. */
        codecs?:
          | string
          | ('PCMU' | 'PCMA' | 'OPUS' | 'G722' | 'G729' | 'AMR-WB' | 'VP8' | 'H264')[]
          | SWMLVar;
        /** Maximum duration in seconds for the call. Defaults to `14400` seconds (4 hours). */
        max_duration?: number | SWMLVar;
        /** Password to use for SIP authentication. */
        password?: string | SWMLVar;
        /** Username to use for SIP authentication. */
        username?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | ('PCMU' | 'PCMA' | 'OPUS' | 'G722' | 'G729' | 'AMR-WB' | 'VP8' | 'H264')[]
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
  [key: string]: unknown;
}

export interface BindDigit {
  /** Bind DTMF digit actions. */
  bind_digit?: {
    digits: string;
    max_triggers?: number | SWMLVar;
    method: string;
    params?: Record<string, unknown>;
    realm?: string;
    [key: string]: Record<string, unknown> | string | number | SWMLVar | undefined;
  };
  [key: string]: unknown;
}

export interface CallDeviceStream {
  authorization_bearer_token?: string | SWMLVar;
  codec?: string | SWMLVar;
  custom_parameters?: Record<string, unknown>;
  name?: string | SWMLVar;
  realtime?: boolean | SWMLVar;
  status_url?: string | SWMLVar;
  status_url_method?: 'GET' | 'POST' | SWMLVar;
  url?: string | SWMLVar;
  [key: string]: unknown;
}

export interface CallPayParameters {
  name?: string | SWMLVar;
  value?: string | SWMLVar;
  [key: string]: unknown;
}

export interface CallPayPrompts {
  actions?: (CallPayPromptsActions | SWMLVar)[] | SWMLVar;
  attempt?: string | SWMLVar;
  card_type?: string | SWMLVar;
  error_type?: string | SWMLVar;
  for?:
    | 'payment-card-number'
    | 'expiration-date'
    | 'security-code'
    | 'postal-code'
    | 'bank-routing-number'
    | 'bank-account-number'
    | 'payment-processing'
    | 'payment-completed'
    | 'payment-failed'
    | 'payment-canceled'
    | SWMLVar;
  play?: (RingbackConfig | SWMLVar)[] | SWMLVar;
  require_matching_inputs?: string | SWMLVar;
  [key: string]: unknown;
}

export interface CallPayPromptsActions {
  type?: 'Say' | 'Play' | SWMLVar;
  phrase?: string | SWMLVar;
  [key: string]: unknown;
}

export interface ClearDigitBindings {
  /** Clear all digit bindings. */
  clear_digit_bindings?: {
    realm?: string;
    [key: string]: Record<string, unknown> | string | undefined;
  };
  [key: string]: unknown;
}

export interface Cond {
  /** Body shape enforced by is_valid_cond_method, swml_schema.c:1271. */
  cond?: {
    else?: SWMLMethod[];
    then?: SWMLMethod[];
    when?: string;
    [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
  }[];
  [key: string]: unknown;
}

export interface Connect {
  /** Dial a SIP URI or phone number. */
  connect?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Body shape enforced by CHECK_swml_connect_device, swml_schema.c. */
export interface ConnectDevice {
  authorization_bearer_token?: string | SWMLVar;
  call_state_events?: string[] | SWMLVar;
  call_state_url?: string | SWMLVar;
  codec?: string | SWMLVar;
  codecs?: string | Record<string, unknown>[];
  confirm?:
    | string
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: Record<string, unknown>;
        [key: string]: Record<string, unknown> | undefined;
      }
    | SWMLVar;
  confirm_timeout?: number | SWMLVar;
  custom_parameters?: Record<string, string> | SWMLVar;
  encryption?: 'mandatory' | 'optional' | 'forbidden' | SWMLVar;
  from?: string | SWMLVar;
  from_name?: string | SWMLVar;
  headers?: ConnectSipHeader[];
  name?: string | SWMLVar;
  password?: string | SWMLVar;
  realtime?: boolean | SWMLVar;
  session_timeout?: number | SWMLVar;
  status_url?: string | SWMLVar;
  status_url_method?: 'GET' | 'POST' | SWMLVar;
  timeout?: number | SWMLVar;
  to?: string | SWMLVar;
  username?: string | SWMLVar;
  webrtc_media?: boolean | SWMLVar;
  [key: string]: unknown;
}

/** Body shape enforced by CHECK_swml_connect_serial_parallel, swml_schema.c. */
export type ConnectSerialParallel = ConnectDevice[];

export interface ConnectSipHeader {
  name?: string;
  value?: string | SWMLVar;
  [key: string]: unknown;
}

export interface Context {
  consolidate?: boolean | string;
  enter_fillers?: Record<string, unknown>;
  exit_fillers?: Record<string, unknown>;
  full_reset?: boolean | string;
  history?: string;
  initial_step?: string;
  isolated?: boolean | string;
  pom?: PromptPomSection[];
  post_prompt?: Record<string, unknown>;
  prompt?: string;
  reset?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  steps?: Step[];
  system_prompt?: string;
  user_prompt?: string;
  valid_contexts?: unknown[];
  valid_steps?: unknown[];
  [key: string]: unknown;
}

export interface DataMap {
  contexts?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  expressions?: Expression[] | Expression;
  output?: SwaigResponse;
  webhooks?: Webhook[] | Webhook;
  [key: string]: unknown;
}

export interface Denoise {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  denoise?:
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface DetectMachine {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  detect_machine?:
    | {
        /** If `true`, stops detection on beep / end of voicemail greeting. Default `false`. */
        detect_message_end?: boolean | SWMLVar;
        /** Comma-separated string of detectors to enable. Valid values: `amd`, `fax`. */
        detectors?: string | SWMLVar;
        /** How long to wait for voice to finish. Default `1.0`. */
        end_silence_timeout?: number | SWMLVar;
        /** How long to wait for initial voice before giving up. Default `4.5`. */
        initial_timeout?: number | SWMLVar;
        /** How long to wait for voice to finish before firing READY event. Default is `end_silence_timeout`. */
        machine_ready_timeout?: number | SWMLVar;
        /** The number of seconds of ongoing voice activity required to classify as MACHINE. Default `1.25`. */
        machine_voice_threshold?: number | SWMLVar;
        /** The minimum number of words that must be detected in a single utterance before classifying the call as MACHINE. Default `6`. */
        machine_words_threshold?: number | SWMLVar;
        /** The http(s) URL to deliver detector events to. */
        status_url?: string | SWMLVar;
        /** The max time to run detector. Default `30.0` seconds. */
        timeout?: number | SWMLVar;
        /** The tone to detect, will only receive remote side tone. Default `CED`. */
        tone?: 'CNG' | 'CED' | 'cng' | 'ced' | SWMLVar;
        /** If false, the detector will run asynchronously and status_url must be set. */
        wait?: boolean | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | number
          | SWMLVar
          | 'CNG'
          | 'CED'
          | 'cng'
          | 'ced'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Dial {
  /** Dial out to one or more endpoints (deprecated). */
  dial?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Echo {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  echo?:
    | {
        timeout?: number | SWMLVar;
        [key: string]: Record<string, unknown> | number | SWMLVar | undefined;
      }
    | unknown[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
  [key: string]: unknown;
}

export interface EnterQueue {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  enter_queue?:
    | {
        execute_after_queue?: string | SWMLVar;
        /** Name of the queue to enter. If a queue with this name does not exist, it will be automatically created. */
        queue_name: string | SWMLVar;
        /** HTTP or HTTPS URL to deliver queue status events. Default not set */
        status_url?: string | SWMLVar;
        /** Maximum time in seconds to wait in the queue before timeout. Default `180` */
        wait_time?: number | SWMLVar;
        /** URL for media to play while waiting in the queue. Default hold music will be played if not set */
        wait_url?: string | SWMLVar;
        whisper_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | number | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Eval {
  /** Evaluate expressions and assign to variables (deprecated). */
  eval?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Execute {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  execute?:
    | {
        /** Name of the section to execute. Must reference a section in the current document. */
        dest: string | SWMLVar;
        /** User-defined metadata, ignored by SignalWire */
        meta?: Record<string, unknown>;
        /** The list of SWML instructions to be executed when the executed section or URL returns */
        on_return?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            };
        /** Parameters accessible as `params.*` in the called section. Replaces (does not merge with) any outer `params` from the caller. */
        params?: Record<string, unknown> | SWMLVar;
        /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
        result?:
          | {
              else?: SWMLMethod[];
              then?: SWMLMethod[];
              when?: string;
              [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
            }[]
          | {
              /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
              default?:
                | SWMLMethod[]
                | {
                    code: Record<string, unknown>;
                    meta?: Record<string, unknown>;
                    [key: string]: Record<string, unknown> | undefined;
                  };
              /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
              case?: Record<
                string,
                | SWMLMethod[]
                | {
                    code: Record<string, unknown>;
                    meta?: Record<string, unknown>;
                    [key: string]: Record<string, unknown> | undefined;
                  }
              >;
              /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
              variable?: string | SWMLVar;
              [key: string]:
                | Record<string, unknown>
                | SWMLMethod[]
                | {
                    code: Record<string, unknown>;
                    meta?: Record<string, unknown>;
                    [key: string]: Record<string, unknown> | undefined;
                  }
                | Record<
                    string,
                    | SWMLMethod[]
                    | {
                        code: Record<string, unknown>;
                        meta?: Record<string, unknown>;
                        [key: string]: Record<string, unknown> | undefined;
                      }
                  >
                | string
                | SWMLVar
                | undefined;
            };
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            }
          | Record<string, unknown>
          | SWMLVar
          | {
              else?: SWMLMethod[];
              then?: SWMLMethod[];
              when?: string;
              [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
            }[]
          | {
              /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
              default?:
                | SWMLMethod[]
                | {
                    code: Record<string, unknown>;
                    meta?: Record<string, unknown>;
                    [key: string]: Record<string, unknown> | undefined;
                  };
              /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
              case?: Record<
                string,
                | SWMLMethod[]
                | {
                    code: Record<string, unknown>;
                    meta?: Record<string, unknown>;
                    [key: string]: Record<string, unknown> | undefined;
                  }
              >;
              /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
              variable?: string | SWMLVar;
              [key: string]:
                | Record<string, unknown>
                | SWMLMethod[]
                | {
                    code: Record<string, unknown>;
                    meta?: Record<string, unknown>;
                    [key: string]: Record<string, unknown> | undefined;
                  }
                | Record<
                    string,
                    | SWMLMethod[]
                    | {
                        code: Record<string, unknown>;
                        meta?: Record<string, unknown>;
                        [key: string]: Record<string, unknown> | undefined;
                      }
                  >
                | string
                | SWMLVar
                | undefined;
            }
          | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface ExecuteRpc {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  execute_rpc?:
    | {
        call_id?: string | SWMLVar;
        method: string | SWMLVar;
        node_id?: string | SWMLVar;
        params?: Record<string, unknown> | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

/** Without one of `expr` / `string` and `output`, a Expression has no effect: it is accepted and ignored, not rejected. */
export interface Expression {
  pattern?: string;
  expr?: string;
  'nomatch-output'?: SwaigResponse;
  output?: SwaigResponse;
  string?: string;
  [key: string]: unknown;
}

/** Without `append`, `input_key` and `output_key`, a Foreach has no effect: it is accepted and ignored, not rejected. */
export interface Foreach {
  append?: string;
  input_key?: string;
  max?: number | string;
  output_key?: string;
  [key: string]: unknown;
}

export interface Goto {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  goto?:
    | {
        /** Label to jump to. Must reference a `label` step in the current section or in a section that encloses it. */
        label: string | SWMLVar;
        /** Maximum number of times this `goto` can jump to its label. Once the limit is reached, */
        max?: number | SWMLVar;
        /** A JavaScript condition that determines whether to perform the jump. If the condition evaluates to true, the jump is executed. If omitted, the jump is unconditional. */
        when?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | number | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface Hangup {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  hangup?:
    | {
        /** The reason for hanging up the call. */
        reason?: 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'hangup'
          | 'cancel'
          | 'busy'
          | 'noAnswer'
          | 'decline'
          | 'error'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | (string & ('hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar));
  [key: string]: unknown;
}

export interface If {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  if?:
    | {
        condition: string | SWMLVar;
        else?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            };
        then?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            };
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            }
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface JoinConference {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  join_conference?:
    | {
        /** Sets the behavior of the beep sound when joining or leaving the conference. Default `\"true\"`. */
        beep?: 'true' | 'false' | 'onEnter' | 'onExit' | SWMLVar;
        /** Coach accepts a call SID of a call that is currently connected to an in-progress conference. */
        coach?: string | SWMLVar;
        emit_call_quality?: boolean | SWMLVar;
        /** Ends the conference when the main participant leaves. This means the end action will not wait on more participants to leave before ending. Default `false`. */
        end_on_exit?: boolean | SWMLVar;
        /** The maximum number of participants allowed in the conference. If the limit is reached, new participants will not be able to join. Default `100000`. */
        max_participants?: number | SWMLVar;
        meta?:
          | {
              private?: Record<string, unknown>;
              public?: Record<string, unknown>;
            }
          | SWMLVar;
        min_participants?: number | SWMLVar;
        /** Whether to join the conference in a muted state. If set to `true`, the participant will be muted upon joining. Default `false`. */
        muted?: boolean | SWMLVar;
        /** A friendly name to identify the stream at the WebSocket endpoint. Default not set */
        name: string | SWMLVar;
        /** Enables or disables recording of the conference. Default `\"do-not-record\"`. */
        record?: 'do-not-record' | 'record-from-start' | SWMLVar;
        /** The URL to which recording status events will be sent. This URL must be publicly accessible and able to handle HTTP requests. Default not set */
        recording_status_callback?: string | SWMLVar;
        /** Space-separated list of one or more events to send to the recording status callback URL. */
        recording_status_callback_event?: string | SWMLVar;
        /** The content type used when sending recording status events to the recording status callback URL. Defaults to `relay`. An unlisted value is rejected rather than falling back to the default. */
        recording_status_callback_event_type?: 'cxml' | 'laml' | 'relay' | SWMLVar;
        /** The HTTP method to use when sending recording status events to the recording status callback URL. Default `\"POST\"`. */
        recording_status_callback_method?: 'GET' | 'POST' | SWMLVar;
        /** Specifies the geographical region where the conference will be hosted. Default not set */
        region?: 'global' | 'us' | 'eu' | 'ch' | SWMLVar;
        /** Starts the conference when the main participant joins. This means the start action will not wait on more participants to join before starting. Default `true`. */
        start_on_enter?: boolean | SWMLVar;
        /** The URL to which status events will be sent. This URL must be publicly accessible and able to handle HTTP requests. Default not set */
        status_callback?: string | SWMLVar;
        /** Space-separated list of one or more events to send to the status callback URL. */
        status_callback_event?: string | SWMLVar;
        /** The content type used when sending status events to the status callback URL. Default not set */
        status_callback_event_type?: 'cxml' | 'laml' | 'relay' | SWMLVar;
        /** The HTTP method to use when sending status events to the status callback URL. Default `\"POST\"`. */
        status_callback_method?: 'GET' | 'POST' | SWMLVar;
        /** Attach a bidirectional WebSocket stream to the conference. Conference audio is streamed to */
        stream?: CallDeviceStream | SWMLVar;
        /** If set to `trim-silence`, it will remove silence from the start of the recording. If set to `do-not-trim`, it will keep the silence. Default `\"trim-silence\"`. */
        trim?: 'trim-silence' | 'do-not-trim' | SWMLVar;
        video?: boolean | SWMLVar;
        video_layout?: string | SWMLVar;
        video_preview?: boolean | SWMLVar;
        video_quality?: '720p' | '1080p' | SWMLVar;
        /** A URL that will play media when the conference is put on hold. Default hold music will be played if not set */
        wait_url?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'true'
          | 'false'
          | 'onEnter'
          | 'onExit'
          | SWMLVar
          | string
          | SWMLVar
          | boolean
          | SWMLVar
          | number
          | SWMLVar
          | {
              private?: Record<string, unknown>;
              public?: Record<string, unknown>;
            }
          | SWMLVar
          | 'do-not-record'
          | 'record-from-start'
          | SWMLVar
          | 'cxml'
          | 'laml'
          | 'relay'
          | SWMLVar
          | 'GET'
          | 'POST'
          | SWMLVar
          | 'global'
          | 'us'
          | 'eu'
          | 'ch'
          | SWMLVar
          | CallDeviceStream
          | SWMLVar
          | 'trim-silence'
          | 'do-not-trim'
          | SWMLVar
          | '720p'
          | '1080p'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface JoinRoom {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  join_room?:
    | {
        /** Name of the room to join. Allowed characters: A-Z, a-z, 0-9, underscore, and hyphen. */
        name: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

/** A JSON Schema (draft 2020-12). The value is forwarded verbatim to the receiving model API, which owns this contract; the engine does not inspect it. */
export interface JsonSchema {
  title?: string;
  description?: string;
  type?:
    | 'array'
    | 'boolean'
    | 'integer'
    | 'null'
    | 'number'
    | 'object'
    | 'string'
    | ('array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string')[];
  const?: Record<string, unknown>;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  default?: Record<string, unknown>;
  examples?: unknown[];
  deprecated?: boolean;
  properties?: Record<string, JsonSchema | boolean>;
  required?: string[];
  prefixItems?: (JsonSchema | boolean)[];
  items?: JsonSchema | boolean;
  propertyNames?: JsonSchema | boolean;
  additionalProperties?: JsonSchema | boolean;
  unevaluatedProperties?: JsonSchema | boolean;
  oneOf?: (JsonSchema | boolean)[];
  anyOf?: (JsonSchema | boolean)[];
  allOf?: (JsonSchema | boolean)[];
  not?: JsonSchema | boolean;
  contains?: JsonSchema | boolean;
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JsonSchema | boolean>;
  else?: JsonSchema | boolean;
  if?: JsonSchema | boolean;
  maxContains?: number;
  minContains?: number;
  multipleOf?: number;
  patternProperties?: Record<string, JsonSchema | boolean>;
  readOnly?: boolean;
  then?: JsonSchema | boolean;
  unevaluatedItems?: JsonSchema | boolean;
  uniqueItems?: boolean;
  writeOnly?: boolean;
  [key: string]: unknown;
}

/** A JSON Schema (draft 2020-12) that may also carry `example`, `nullable`, `propertyOrdering`: the value is forwarded verbatim to whichever model API the session resolves to, and those receivers do not accept one vocabulary, so a schema here must be able to express their UNION (vocabulary_union). The engine does not inspect it. */
export interface JsonSchemaUnion {
  title?: string;
  description?: string;
  type?:
    | 'array'
    | 'boolean'
    | 'integer'
    | 'null'
    | 'number'
    | 'object'
    | 'string'
    | ('array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string')[];
  const?: Record<string, unknown>;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  default?: Record<string, unknown>;
  examples?: unknown[];
  deprecated?: boolean;
  nullable?: boolean;
  properties?: Record<string, JsonSchemaUnion | boolean>;
  required?: string[];
  prefixItems?: (JsonSchemaUnion | boolean)[];
  items?: JsonSchemaUnion | boolean;
  propertyNames?: JsonSchemaUnion | boolean;
  additionalProperties?: JsonSchemaUnion | boolean;
  unevaluatedProperties?: JsonSchemaUnion | boolean;
  oneOf?: (JsonSchemaUnion | boolean)[];
  anyOf?: (JsonSchemaUnion | boolean)[];
  allOf?: (JsonSchemaUnion | boolean)[];
  not?: JsonSchemaUnion | boolean;
  contains?: JsonSchemaUnion | boolean;
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JsonSchemaUnion | boolean>;
  else?: JsonSchemaUnion | boolean;
  example?: Record<string, unknown>;
  if?: JsonSchemaUnion | boolean;
  maxContains?: number;
  minContains?: number;
  multipleOf?: number;
  patternProperties?: Record<string, JsonSchemaUnion | boolean>;
  propertyOrdering?: string[];
  readOnly?: boolean;
  then?: JsonSchemaUnion | boolean;
  unevaluatedItems?: JsonSchemaUnion | boolean;
  uniqueItems?: boolean;
  writeOnly?: boolean;
  [key: string]: unknown;
}

export interface Label {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  label?:
    | {
        /** Mark any point of the SWML section with a label so that `goto` can jump to it. Must be */
        label: string;
        [key: string]: Record<string, unknown> | string;
      }
    | unknown[]
    | number
    | (string & string);
  [key: string]: unknown;
}

export interface LiveTranscribe {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  live_transcribe?:
    | {
        /** The action to perform during live transcription. */
        action?:
          | string
          | {
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    hints?: (string | SWMLVar)[] | SWMLVar;
                    lang?: string | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    verbose_utterances?: boolean | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: Record<string, unknown>;
              summarize?:
                | {
                    ai_model?: string | SWMLVar;
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar;
        hints?:
          | (
              | {
                  pattern?: string | SWMLVar;
                  hint?: string | SWMLVar;
                  ignore_case?: boolean | string | SWMLVar;
                  replace?: string | SWMLVar;
                }
              | string
              | SWMLVar
            )[]
          | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | {
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    hints?: (string | SWMLVar)[] | SWMLVar;
                    lang?: string | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    verbose_utterances?: boolean | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: Record<string, unknown>;
              summarize?:
                | {
                    ai_model?: string | SWMLVar;
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar
          | (
              | {
                  pattern?: string | SWMLVar;
                  hint?: string | SWMLVar;
                  ignore_case?: boolean | string | SWMLVar;
                  replace?: string | SWMLVar;
                }
              | string
              | SWMLVar
            )[]
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface LiveTranslate {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  live_translate?:
    | {
        /** The action to perform during live translation. */
        action?:
          | string
          | {
              inject?:
                | {
                    direction?: string | SWMLVar;
                    message?: string | SWMLVar;
                  }
                | SWMLVar;
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    filter_from?: string | SWMLVar;
                    filter_to?: string | SWMLVar;
                    from_lang?: string | SWMLVar;
                    from_voice?: string | SWMLVar;
                    from_voice_params?: Record<string, unknown> | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    mode?: string | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    to_lang?: string | SWMLVar;
                    to_voice?: string | SWMLVar;
                    to_voice_params?: Record<string, unknown> | SWMLVar;
                    translation_model?: string | SWMLVar;
                    translation_model_params?: Record<string, unknown> | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: Record<string, unknown>;
              summarize?:
                | {
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | {
              inject?:
                | {
                    direction?: string | SWMLVar;
                    message?: string | SWMLVar;
                  }
                | SWMLVar;
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    filter_from?: string | SWMLVar;
                    filter_to?: string | SWMLVar;
                    from_lang?: string | SWMLVar;
                    from_voice?: string | SWMLVar;
                    from_voice_params?: Record<string, unknown> | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    mode?: string | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    to_lang?: string | SWMLVar;
                    to_voice?: string | SWMLVar;
                    to_voice_params?: Record<string, unknown> | SWMLVar;
                    translation_model?: string | SWMLVar;
                    translation_model_params?: Record<string, unknown> | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: Record<string, unknown>;
              summarize?:
                | {
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Pay {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  pay?:
    | {
        /** Custom description of the payment provided in the request. */
        description?: string | SWMLVar;
        bank_account_type?:
          'consumer-checking' | 'consumer-savings' | 'commercial-checking' | SWMLVar;
        /** The amount to charge against payment method passed in the request. `Float` value with no currency prefix passed as string. */
        charge_amount?: string | SWMLVar;
        /** Uses the ISO 4217 currency code of the charge amount. */
        currency?: string | SWMLVar;
        /** The method of how to collect the payment details. Currently only `dtmf` mode is supported. */
        input?: 'dtmf' | 'voice' | SWMLVar;
        /** Language to use for prompts being played to the caller by the `pay` method. */
        language?: string | SWMLVar;
        /** Number of times the `pay` method will retry to collect payment details. */
        max_attempts?: string | SWMLVar;
        /** The minimum length of the postal code the user must enter. */
        min_postal_code_length?: string | SWMLVar;
        /** Array of parameter objects to pass to your payment processor. The parameters are user-defined key-value pairs. */
        parameters?: (CallPayParameters | SWMLVar)[] | SWMLVar;
        /** The URL to make POST requests with all the gathered payment details. */
        payment_connector_url: string | SWMLVar;
        /** Indicates the payment method which is going to be used in this payment request, `credit-card` or `ach-debit`. Default is `credit-card`. */
        payment_method?: 'credit-card' | 'ach-debit' | SWMLVar;
        /** Takes `true`, `false` or real postalcode (if it's known beforehand) to let pay method know whether to prompt for postal code. Default is `true`. */
        postal_code?: string | SWMLVar;
        /** Array of prompt objects for customizing the audio prompts during different stages of the payment process. */
        prompts?: (CallPayPrompts | SWMLVar)[] | SWMLVar;
        say_voice?: string | SWMLVar;
        /** Takes true or false to let pay method know whether to prompt for security code. */
        security_code?: string | SWMLVar;
        /** The URL to send requests for each status change during the payment process. */
        status_url?: string | SWMLVar;
        /** Limit in seconds that pay method waits for the caller to press another digit before moving on to validate the digits captured. */
        timeout?: string | SWMLVar;
        /** Whether the payment is a one off payment or re-occurring. */
        token_type?: 'one-time' | 'reusable' | SWMLVar;
        /** List of payment cards allowed to use in the requested payment process separated by space. */
        valid_card_types?: string | SWMLVar;
        /** Text-to-speech voice to use. Please refer to [TTS documentation](/docs/platform/voice/tts) for more information. */
        voice?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | 'consumer-checking'
          | 'consumer-savings'
          | 'commercial-checking'
          | SWMLVar
          | 'dtmf'
          | 'voice'
          | SWMLVar
          | (CallPayParameters | SWMLVar)[]
          | SWMLVar
          | 'credit-card'
          | 'ach-debit'
          | SWMLVar
          | (CallPayPrompts | SWMLVar)[]
          | SWMLVar
          | 'one-time'
          | 'reusable'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Play {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  play?:
    | {
        /** If `true`, the call will automatically answer as the sound is playing. If `false`, you will start playing the audio during early media. Default `true`. */
        auto_answer?: boolean | string | SWMLVar;
        loop?: number | SWMLVar;
        /** Gender to use for the text to speech. */
        say_gender?: 'male' | 'female' | SWMLVar;
        /** The language to use for the text to speech. */
        say_language?: string | SWMLVar;
        /** The voice to use for the text to speech. */
        say_voice?: string | SWMLVar;
        /** http or https URL to deliver play status events */
        status_url?: string | SWMLVar;
        /** URL to play. */
        url?: string;
        /** Array of URLs to play. */
        urls?: string[];
        /** Volume level for the audio file. */
        volume?: number | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | boolean
          | string
          | SWMLVar
          | number
          | SWMLVar
          | 'male'
          | 'female'
          | SWMLVar
          | string
          | SWMLVar
          | string
          | string[]
          | undefined;
      }
    | unknown[]
    | number
    | (string & string);
  [key: string]: unknown;
}

export interface Prompt {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  prompt?:
    | {
        /** Time in seconds to wait for next digit. */
        digit_timeout?: number | SWMLVar;
        /** Time in seconds to wait for start of input. */
        initial_timeout?: number | SWMLVar;
        /** Number of digits to collect. */
        max_digits?: number | SWMLVar;
        /** URL or array of URLs to play. */
        play?: RingbackConfig | unknown[] | string;
        /** The gender to use for the text to speech. */
        say_gender?: 'male' | 'female' | SWMLVar;
        /** The language to use for the text to speech. */
        say_language?: string | SWMLVar;
        /** The voice to use for the text to speech. */
        say_voice?: string | SWMLVar;
        /** Time in seconds to wait for end of speech utterance. */
        speech_end_timeout?: number | SWMLVar;
        /** The engine that is selected for speech recognition. The engine must support the specified language. */
        speech_engine?: 'Google' | 'Google.V2' | 'Deepgram' | SWMLVar;
        /** Expected words or phrases to help the speech recognition. */
        speech_hints?: string[];
        /** Language to detect speech in. */
        speech_language?: string | SWMLVar;
        /** Max time in seconds to wait for speech result. */
        speech_timeout?: number | SWMLVar;
        /** http or https URL to deliver prompt status events */
        status_url?: string | SWMLVar;
        /** Digits that terminate digit collection. */
        terminators?: string | SWMLVar;
        url?: string;
        /** Volume level for the audio file. */
        volume?: number | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | number
          | SWMLVar
          | RingbackConfig
          | unknown[]
          | string
          | 'male'
          | 'female'
          | SWMLVar
          | string
          | SWMLVar
          | 'Google'
          | 'Google.V2'
          | 'Deepgram'
          | SWMLVar
          | string[]
          | string
          | undefined;
      }
    | unknown[]
    | number
    | (string & string);
  [key: string]: unknown;
}

/** Without one of `body` / `bullets` / `subsections`, the object has no effect: it is accepted and ignored, not rejected. */
export interface PromptPomSection {
  title?: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: PromptPomSection[];
  [key: string]: unknown;
}

export interface ReceiveFax {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  receive_fax?:
    | {
        /** http or https URL to deliver receive_fax status events */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface Record_ {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  record?:
    | {
        /** The format to record in. Can be `wav`, `mp3`, or `mp4`. */
        format?: 'wav' | 'mp3' | 'mp4' | SWMLVar;
        /** Play a beep before recording. */
        beep?: boolean | SWMLVar;
        /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** Time in seconds to wait in silence before ending the recording. */
        end_silence_timeout?: number | SWMLVar;
        /** Time in seconds to wait for the start of speech. */
        initial_timeout?: number | SWMLVar;
        /** How sensitive the recording voice activity detector is to background noise. */
        input_sensitivity?: number | SWMLVar;
        /** Maximum length of the recording in seconds. */
        max_length?: number | SWMLVar;
        /** URL to send recording status events to. */
        status_url?: string | SWMLVar;
        /** If true, record in stereo. */
        stereo?: boolean | SWMLVar;
        /** String of digits that will stop the recording when pressed. Default is `\"#\"`. */
        terminators?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'wav'
          | 'mp3'
          | 'mp4'
          | SWMLVar
          | boolean
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface RecordCall {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  record_call?:
    | {
        /** The format to record in. It can be `wav`, `mp3`, or `mp4`. */
        format?: 'wav' | 'mp3' | 'mp4' | SWMLVar;
        /** Play a beep before recording. */
        beep?: boolean | SWMLVar;
        /** Identifier for this recording, to use with `stop_record_call`. */
        control_id?: string | SWMLVar;
        /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** Time in seconds to wait in silence before ending the recording. Must be at least `1`; `0` and fractional values below `1` are rejected. */
        end_silence_timeout?: number | SWMLVar;
        /** Time in seconds to wait for the start of speech. Must be at least `1`; `0` and fractional values below `1` are rejected. */
        initial_timeout?: number | SWMLVar;
        /** How sensitive the recording voice activity detector is to background noise. */
        input_sensitivity?: number | SWMLVar;
        /** Maximum length of the recording in seconds. */
        max_length?: number | SWMLVar;
        /** http or https URL to deliver record_call status events */
        status_url?: string | SWMLVar;
        /** If `true`, record in stereo. */
        stereo?: boolean | SWMLVar;
        /** String of digits that will stop the recording when pressed. Default is `\"\"` (empty). */
        terminators?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'wav'
          | 'mp3'
          | 'mp4'
          | SWMLVar
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Request {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  request?:
    | {
        /** Request body. Objects are JSON-encoded automatically. */
        body?: Record<string, unknown> | Record<string, unknown>[] | string | number | boolean;
        /** Maximum time in seconds to wait for a connection. Defaults to `5` when the key is absent, and is clamped to a maximum of `30`. Fractional input is truncated to an integer. */
        connect_timeout?: number | SWMLVar;
        /** HTTP headers to include with the request, as a map of header name to value. Each value must be a string. */
        headers?: Record<string, unknown>;
        /** The HTTP method to be used for the request. Can be `GET`, `POST`, `PUT`, or `DELETE`. */
        method: 'get' | 'GET' | 'put' | 'PUT' | 'POST' | 'post' | 'DELETE' | 'delete' | SWMLVar;
        /** If `true`, parse the JSON response into `request_response.*` variables. */
        save_variables?: boolean | SWMLVar;
        /** Timeout in seconds. Defaults to `5` when the key is absent, and is clamped to a maximum of `30`. Fractional input is truncated to an integer. */
        timeout?: number | SWMLVar;
        /** Endpoint to call. Must be a publicly reachable URL. */
        url: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | Record<string, unknown>
          | Record<string, unknown>[]
          | string
          | number
          | boolean
          | number
          | SWMLVar
          | 'get'
          | 'GET'
          | 'put'
          | 'PUT'
          | 'POST'
          | 'post'
          | 'DELETE'
          | 'delete'
          | SWMLVar
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Return {
  /** Body shape enforced by CHECK_swml_method_return, swml_schema.c:1495. */
  return?: Record<string, unknown> | unknown[] | boolean | null | number | string;
  [key: string]: unknown;
}

export interface Ring {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  ring?:
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

/** Declared as a named $defs entry so every generator emits a TYPED shape via $ref rather than collapsing an inline object to an untyped map. */
export interface RingbackConfig {
  /** URL to play. */
  url?: string;
  /** Array of URLs to play. */
  urls?: string[];
  /** Volume level for the audio file. */
  volume?: number | SWMLVar;
  [key: string]: unknown;
}

export interface SIPRefer {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  sip_refer?: Record<string, unknown> | unknown[] | number | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export type SWMLMethod =
  | AI
  | AiSidecar
  | AmazonBedrock
  | Answer
  | BindDigit
  | ClearDigitBindings
  | Cond
  | Connect
  | Denoise
  | DetectMachine
  | Dial
  | Echo
  | EnterQueue
  | Eval
  | Execute
  | ExecuteRpc
  | Goto
  | Hangup
  | If
  | JoinConference
  | JoinRoom
  | Label
  | LiveTranscribe
  | LiveTranslate
  | Pay
  | Play
  | Prompt
  | ReceiveFax
  | Record_
  | RecordCall
  | Request
  | Return
  | Ring
  | SIPRefer
  | SendDigits
  | SendFax
  | SendSMS
  | Set_
  | SetCapabilities
  | SetMeta
  | Sleep
  | StopDenoise
  | StopRecordCall
  | StopStream
  | StopTap
  | Stream
  | Switch
  | Tap
  | Transcribe
  | TranscribeStop
  | Transfer
  | Unset
  | UserEvent;

/** A SWML variable reference using ${varname} or %{varname} syntax for dynamic value substitution at runtime. */
export type SWMLVar = string;

export interface Section {
  main?: SWMLMethod[];
  [key: string]: unknown;
}

export interface SendDigits {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  send_digits?:
    | {
        /** The digits to send. Valid values are 0123456789*#ABCDWw. Character W is a 1 second delay, and w is a 500ms delay. */
        digits: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface SendFax {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  send_fax?:
    | {
        /** URL to the PDF document to fax. */
        document: string | SWMLVar;
        /** Header text to include on the fax. */
        header_info?: string | SWMLVar;
        /** Station identity to report. */
        identity?: string | SWMLVar;
        /** http or https URL to deliver send_fax status events */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface SendSMS {
  /** Send an outbound SMS or MMS message to a PSTN phone number. */
  send_sms?: {
    /** Optional if `media` is present. The body of the SMS message. */
    body?: string | SWMLVar;
    /** Phone number the SMS message will be sent from in E.164 format. */
    from_number: string | SWMLVar;
    /** Required if `body` is not present. Array of media URLs to include in the message. */
    media?: string[];
    /** Region of the world to originate the message from. Chosen based on account preferences or device location if not specified. */
    region?: string | SWMLVar;
    /** URL to receive delivery status callbacks for the outbound message (e.g., `queued`, `sent`, `delivered`, `failed`). Not set if not specified. The callback uses the [message status callback payload](/docs/apis/rest/messages/webhooks/message-status-callback). */
    status_callback?: string | SWMLVar;
    /** Array of tags to associate with the message to facilitate log searches. */
    tags?: string[];
    /** Phone number to send SMS message to in E.164 format. */
    to_number: string | SWMLVar;
    [key: string]: Record<string, unknown> | string | SWMLVar | string[] | undefined;
  };
  [key: string]: unknown;
}

export interface Set_ {
  /** Set script variables to the specified values. */
  set?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SetCapabilities {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  set_capabilities?:
    | {
        capabilities: (string | SWMLVar)[] | SWMLVar;
        [key: string]: Record<string, unknown> | (string | SWMLVar)[] | SWMLVar;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface SetMeta {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  set_meta?:
    | {
        private?: Record<string, unknown> | SWMLVar;
        public?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Sleep {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  sleep?:
    | {
        /** The amount of time to sleep in milliseconds. */
        duration: number | SWMLVar;
        [key: string]: Record<string, unknown> | number | SWMLVar;
      }
    | unknown[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
  [key: string]: unknown;
}

export interface Step {
  end?: boolean | string;
  functions?: unknown[];
  gather_info?: Record<string, unknown>;
  history?: string;
  name?: string;
  pom?: PromptPomSection[];
  reset?: Record<string, unknown>;
  skip_to_next_step?: boolean | string;
  skip_user_turn?: boolean | string;
  step_criteria?: string;
  text?: string;
  valid_contexts?: string[];
  valid_steps?: string[];
  [key: string]: unknown;
}

export interface StopDenoise {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_denoise?:
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface StopRecordCall {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_record_call?:
    | {
        /** Identifier for the recording to stop. */
        control_id?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface StopStream {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_stream?:
    | {
        /** ID of the stream to stop. */
        control_id?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | (string & (Record<string, unknown> | SWMLVar));
  [key: string]: unknown;
}

export interface StopTap {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_tap?:
    | {
        /** ID of the tap to stop. */
        control_id?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | (string & (Record<string, unknown> | SWMLVar));
  [key: string]: unknown;
}

export interface Stream {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stream?:
    | {
        /** Bearer token sent as an `Authorization` header during the WebSocket handshake. */
        authorization_bearer_token?: string | SWMLVar;
        /** Codec to use for the streamed audio. Freeform and endpoint-specific. */
        codec?: string | SWMLVar;
        /** Identifier for this stream to use with `stop_stream`. If not set, one is generated and stored in the `stream_control_id` variable. */
        control_id?: Record<string, unknown> | SWMLVar;
        /** Custom key-value pairs sent to the WebSocket endpoint in the start message. */
        custom_parameters?: Record<string, unknown>;
        /** Friendly name for the stream. */
        name?: string | SWMLVar;
        /** HTTP or HTTPS URL to deliver stream status events. */
        status_url?: string | SWMLVar;
        /** HTTP method used to deliver stream status events to `status_url`. */
        status_url_method?: 'GET' | 'POST' | SWMLVar;
        /** Audio track to stream: */
        track?: 'inbound_track' | 'outbound_track' | 'both_tracks' | SWMLVar;
        /** Secure WebSocket URI (wss://) to stream the call audio to. */
        url: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | 'GET'
          | 'POST'
          | SWMLVar
          | 'inbound_track'
          | 'outbound_track'
          | 'both_tracks'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface SwaigAction {
  SWML?: string | Record<string, unknown>;
  add_dynamic_hints?: (
    | {
        pattern?: string;
        hint?: string;
        ignore_case?: boolean | string;
        replace?: string;
      }
    | string
  )[];
  back_to_back_functions?: boolean | 'forever' | string;
  change_context?: string;
  change_step?: string;
  change_voice?:
    | string
    | {
        voice?: Record<string, unknown>;
      };
  clear_dynamic_hints?: boolean | string;
  context_switch?:
    | string
    | {
        consolidate?: boolean | string;
        full_reset?: boolean | string;
        system_pom?: {
          pom?: PromptPomSection[];
          text?: string;
        };
        system_prompt?: string;
        user_pom?: {
          pom?: PromptPomSection[];
          text?: string;
        };
        user_prompt?: string;
      };
  end_of_speech_timeout?: number;
  extensive_data?: boolean | string;
  functions_on_speaker_timeout?: boolean | string;
  hangup?: boolean | string;
  hold?:
    | number
    | string
    | {
        step?: string;
        timeout?: number | string;
        timeout_step?: string;
      };
  playback_bg?:
    | string
    | {
        file?: string;
        wait?: boolean | string;
      };
  replace_in_history?: string | true;
  say?: string;
  set_global_data?: Record<string, unknown>;
  set_meta_data?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  speech_event_timeout?: number;
  stop?: boolean | string;
  stop_playback_bg?: boolean | string | number | Record<string, unknown> | unknown[] | null;
  toggle_functions?: {
    active?: boolean | number | string;
    function?: string;
  }[];
  transfer?:
    | string
    | {
        dest?: string;
        summarize?: boolean | string;
      };
  unset_global_data?: string | string[];
  unset_meta_data?: string | string[];
  user_event?: Record<string, unknown>;
  user_input?: string;
  wait_for_user?: boolean | number | 'answer_first' | string;
  [key: string]: unknown;
}

export interface SwaigResponse {
  action?: SwaigAction | SwaigAction[];
  post_process?: boolean;
  response?:
    | string
    | {
        tool_prompt?: string;
        tool_result?: string;
      };
  [key: string]: unknown;
}

export interface Switch {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  switch?:
    | {
        /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
        default?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            };
        /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
        case?: Record<
          string,
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            }
        >;
        /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
        variable: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            }
          | Record<
              string,
              | SWMLMethod[]
              | {
                  code: Record<string, unknown>;
                  meta?: Record<string, unknown>;
                  [key: string]: Record<string, unknown> | undefined;
                }
            >
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface Tap {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  tap?:
    | {
        /** Codec to use for the tap media stream. */
        codec?: 'PCMA' | 'PCMU' | 'pcma' | 'pcmu' | SWMLVar;
        /** Identifier for this tap to use with `stop_tap`. */
        control_id?: Record<string, unknown> | SWMLVar;
        /** Direction of the audio to tap: */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** If `uri` is a `rtp://` this will set the packetization time of the media in milliseconds. */
        rtp_ptime?: number | SWMLVar;
        /** http or https URL to deliver tap status events */
        status_url?: string | SWMLVar;
        /** Destination of the tap media stream: rtp://IP:port, ws://example.com, or wss://example.com. */
        uri: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'PCMA'
          | 'PCMU'
          | 'pcma'
          | 'pcmu'
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface Transcribe {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  transcribe?:
    | {
        /** An HTTP or HTTPS URL that receives the status callback when the transcription finishes */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

export interface TranscribeStop {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  transcribe_stop?: Record<string, unknown> | unknown[] | number | string;
  [key: string]: unknown;
}

export interface Transfer {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  transfer?:
    | {
        /** URL (`http` or `https`) to fetch the new SWML document from. Authentication can */
        dest: string | SWMLVar;
        /** User data, ignored by SignalWire. */
        meta?: Record<string, unknown>;
        /** Parameters to include in the request body of the fetch. Available as `params.*` in the transferred document. */
        params?: Record<string, unknown> | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | (string & (string | SWMLVar));
  [key: string]: unknown;
}

export interface Unset {
  /** Body shape enforced by CHECK_swml_method_unset, swml_schema.c. */
  unset?: string[] | string;
  [key: string]: unknown;
}

export interface UserEvent {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  user_event?:
    | {
        event?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]: unknown;
}

/** Without one of `expressions` / `output` and `url`, a Webhook has no effect: it is accepted and ignored, not rejected. */
export interface Webhook {
  error_keys?: unknown[] | string;
  expressions?: Expression[] | Expression;
  foreach?: Foreach;
  form_param?: string;
  headers?: Record<string, unknown>;
  input_args_as_params?: boolean;
  method?: string;
  output?: SwaigResponse;
  params?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  require_args?: unknown[] | string;
  url?: string;
  [key: string]: unknown;
}

/** Bind DTMF digit actions. */
export interface BindDigitConfig {
  digits?: string;
  max_triggers?: number | SWMLVar;
  method?: string;
  params?: Record<string, unknown>;
  realm?: string;
  [key: string]: unknown;
}

/** Clear all digit bindings. */
export interface ClearDigitBindingsConfig {
  realm?: string;
  [key: string]: unknown;
}

/** Dial a SIP URI or phone number. */
export interface ConnectConfig {
  /** Delay answer until the B-leg answers. */
  answer_on_bridge?: boolean | string | SWMLVar;
  authorization_bearer_token?: string | SWMLVar;
  /** An array of call state event names to be notified about. */
  call_state_events?: string[] | SWMLVar;
  /** Webhook URL to send call status change notifications to. Authentication can also be set in the URL in the format of `username:password@url`. */
  call_state_url?: string | SWMLVar;
  codec?: string | SWMLVar;
  /** Comma-separated string of codecs to offer. */
  codecs?: string | Record<string, unknown>[] | SWMLVar;
  /** Confirmation to execute when the call is connected. Can be either: */
  confirm?:
    | string
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: Record<string, unknown>;
        [key: string]: Record<string, unknown> | undefined;
      }
    | SWMLVar;
  /** The amount of time, in seconds, to wait for the `confirm` URL to return a response */
  confirm_timeout?: number | SWMLVar;
  custom_parameters?: Record<string, string> | SWMLVar;
  /** Encryption setting to use. **Possible values:** `mandatory`, `optional`, `forbidden` */
  encryption?: 'mandatory' | 'optional' | 'forbidden' | SWMLVar;
  execute_after_queue?: string | SWMLVar;
  /** The caller ID to use when dialing the number. */
  from?: string | SWMLVar;
  /** The caller ID name shown to the person you're calling, displayed alongside the `from` number */
  from_name?: string | SWMLVar;
  /** Custom SIP headers to add to INVITE. It Has no effect on calls to phone numbers. */
  headers?: ConnectSipHeader[];
  /** Maximum duration, in seconds, allowed for the call. */
  max_duration?: number | SWMLVar;
  name?: string | SWMLVar;
  /** Array of destination objects to dial simultaneously. All destinations ring at the same time — the first to answer is bridged and the remaining calls are cancelled. */
  parallel?: ConnectDevice[];
  /** SIP password to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  password?: string | SWMLVar;
  realtime?: boolean | SWMLVar;
  /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
  result?:
    | {
        else?: SWMLMethod[];
        then?: SWMLMethod[];
        when?: string;
        [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
      }[]
    | {
        /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
        default?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            };
        /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
        case?: Record<
          string,
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            }
        >;
        /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
        variable?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: Record<string, unknown>;
              [key: string]: Record<string, unknown> | undefined;
            }
          | Record<
              string,
              | SWMLMethod[]
              | {
                  code: Record<string, unknown>;
                  meta?: Record<string, unknown>;
                  [key: string]: Record<string, unknown> | undefined;
                }
            >
          | string
          | SWMLVar
          | undefined;
      };
  /** Ringback to play while the call is connecting: a URL, a list of URLs, or a play object (`url` / `urls` / `volume`). `false` turns the generated ringback off and passes the far end's early media through. If not specified, plays audio from the provider. */
  ringback?: boolean | string | unknown[] | RingbackConfig;
  /** Array of destination objects to dial in order. Each destination is tried sequentially — if the current destination does not answer, the next one in the array is attempted. */
  serial?: ConnectDevice[];
  /** Two-dimensional array combining serial and parallel strategies. */
  serial_parallel?: ConnectSerialParallel[];
  /** Time, in seconds, to set the SIP `Session-Expires` header in INVITE. */
  session_timeout?: number | SWMLVar;
  /** HTTP or HTTPS URL to deliver connect status events. */
  status_url?: string | SWMLVar;
  status_url_method?: 'GET' | 'POST' | SWMLVar;
  stop_all_on_reject?: Record<string, unknown>[] | boolean | string | SWMLVar;
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number | SWMLVar;
  /** Destination to dial. Can be: */
  to?: string | SWMLVar;
  /** SIP username to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  username?: string | SWMLVar;
  /** If true, WebRTC media is offered to the SIP endpoint. */
  webrtc_media?: boolean | SWMLVar;
  [key: string]: unknown;
}

/** Dial out to one or more endpoints (deprecated). */
export interface DialConfig {
  answer_on_bridge?: boolean | string;
  call_state_events?: string[] | SWMLVar;
  call_state_url?: string | SWMLVar;
  codecs?: string | Record<string, unknown>[] | SWMLVar;
  confirm?:
    | string
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: Record<string, unknown>;
        [key: string]: Record<string, unknown> | undefined;
      }
    | SWMLVar;
  confirm_timeout?: number | SWMLVar;
  dest_swml?: string | Record<string, unknown> | Record<string, unknown>[];
  encryption?: 'mandatory' | 'optional' | 'forbidden' | SWMLVar;
  execute_after_queue?: string | SWMLVar;
  from?: string | SWMLVar;
  from_name?: string | SWMLVar;
  headers?: ConnectSipHeader[];
  max_duration?: number | SWMLVar;
  parallel?: ConnectDevice[];
  password?: string | SWMLVar;
  result?: Record<string, unknown>;
  ringback?: RingbackConfig | unknown[] | string;
  serial?: ConnectDevice[];
  serial_parallel?: ConnectSerialParallel[];
  session_timeout?: number | SWMLVar;
  status_url?: string | SWMLVar;
  stop_all_on_reject?: Record<string, unknown>[] | boolean | string | SWMLVar;
  timeout?: number | SWMLVar;
  to?: string | SWMLVar;
  username?: string | SWMLVar;
  webrtc_media?: boolean | SWMLVar;
  [key: string]: unknown;
}

/** Send an outbound SMS or MMS message to a PSTN phone number. */
export interface SendSmsConfig {
  /** Optional if `media` is present. The body of the SMS message. */
  body?: string | SWMLVar;
  /** Phone number the SMS message will be sent from in E.164 format. */
  from_number?: string | SWMLVar;
  /** Required if `body` is not present. Array of media URLs to include in the message. */
  media?: string[];
  /** Region of the world to originate the message from. Chosen based on account preferences or device location if not specified. */
  region?: string | SWMLVar;
  /** URL to receive delivery status callbacks for the outbound message (e.g., `queued`, `sent`, `delivered`, `failed`). Not set if not specified. The callback uses the [message status callback payload](/docs/apis/rest/messages/webhooks/message-status-callback). */
  status_callback?: string | SWMLVar;
  /** Array of tags to associate with the message to facilitate log searches. */
  tags?: string[];
  /** Phone number to send SMS message to in E.164 format. */
  to_number?: string | SWMLVar;
  [key: string]: unknown;
}
