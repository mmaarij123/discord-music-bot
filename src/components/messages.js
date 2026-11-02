import { ContainerBuilder, TextDisplayBuilder, MessageFlags, MessageFlagsBitField } from 'discord.js';

export const textDisplay=content=>new TextDisplayBuilder().setContent(content);
export function componentsMessage(components){
  return {flags:MessageFlags.IsComponentsV2,components,allowedMentions:{parse:[],repliedUser:false}};
}
export function textMessage(content){return componentsMessage([textDisplay(content)]);}
export function panelsMessage(panels){
  return componentsMessage(panels.map(panel=>{
    const container=new ContainerBuilder().setAccentColor(panel.color).addTextDisplayComponents(textDisplay(panel.title));
    if(panel.description)container.addTextDisplayComponents(textDisplay(panel.description));
    return container;
  }));
}
export function isComponentsV2(message){return new MessageFlagsBitField(message?.flags??0).has(MessageFlags.IsComponentsV2);}
export function componentsEdit(message,payload,wasV2=isComponentsV2(message)){
  // Upgrading an existing message requires clearing its legacy body. Do not
  // include those legacy fields on new V2 sends or subsequent V2 edits.
  return isComponentsV2(payload)&&!wasV2?{...payload,content:null,embeds:[],attachments:[]}:payload;
}
